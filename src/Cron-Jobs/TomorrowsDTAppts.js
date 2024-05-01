const highPriorityColor = '#ffff00';

async function getTomorrowsDTAppts() {
    console.log('running getTomrrowsDTAppts job...');
    const [tomorrowStart, tomorrowEnd] = epochRangeForTomorrow();
    const tomorrowsDateStr = convertEpochToUserTimezoneDate(tomorrowStart);
    console.log('querying for tomorrows appointments...')
    const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
    const allOfTomorrowsAppts = fetchAndParse(url);
    const dtAppts = filterAndSortDTAppts(allOfTomorrowsAppts);
    await getAllEzyVetData(dtAppts, tomorrowsDateStr);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
    const range = sheet.getRange(`A4:H204`)
    range.clearContent()
        .setWrap(true)
        .setFontColor("black")
        .setBackground("white")
        .setFontLine("none");

    putDataOnSheet(dtAppts, range, tomorrowsDateStr);
};

function filterAndSortDTAppts(allOfTomorrowsAppts) {
    // filter all appts down to DT exams/techs
    const dtResourceIDs = new Set([ // non procedures dt columns
        '35', // dt dvm 1
        '55', // used to be dt dvm 2, though it is not currently active 3/16/24
        // '56', // dt tech
        '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
        '1082' // dt DVM :15/:45
    ]);
    const dtAppts = allOfTomorrowsAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam or tech column
            && appointment.details.appointment_type_id !== '4'; // & is not a blocked off spot
    });

    return dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);
    // .slice(0, 3); // slicing for dev
}

// get data from all endpoints that we care about that are associated with each appointment
async function getAllEzyVetData(dtAppts, tomorrowsDateStr) {
    const animalAttachmentData = firstRoundOfFetches(dtAppts); // animal, contact, consults for animal, prescriptions
    const ezyVetFolder = driveFolderProcessing(tomorrowsDateStr);
    const consultAttachmentData = secondRoundOfFetches(dtAppts); // prescription items, other animals of contact
    await processRecords(animalAttachmentData, consultAttachmentData, dtAppts, ezyVetFolder)
    fetchDataToCheckIfFirstTimeClient(dtAppts, tomorrowsDateStr);
}

function fetchDataToCheckIfFirstTimeClient(dtAppts, tomorrowsDateStr) {
    const consultsForOtherContactAnimalsRequests = [];
    const fetchedForOtherAnimalConsultsArray = [];
    // first check if this patient has previous valid consults
    // if so, were just going to put that last date of this patients visit
    for (let i = 0; i < dtAppts.length; i++) {
        const { appointment, consults, otherAnimalsOfContact, encodedConsultIDs } = dtAppts[i];
        // appointments created through vetstoria do not have an appointment, but we want to count it for this
        const apptHasConsult = appointment.details.consult_id; // check for existence of appointment's consult
        const numberOfConsults = apptHasConsult ? consults.length : consults.length + 1;

        if (numberOfConsults > 1) { // if the animal appears to have been here before..
            consults.sort((a, b) => b.consult.date - a.consult.date);
            const { items: appts } = fetchAndParse(`${proxy}/v1/appointment?active=1&limit=200&consult_id=${encodedConsultIDs}`);
            for (const { consult } of consults) {
                const apptForThisConsult = appts.find(({ appointment }) => Number(consult.id) === appointment.details.consult_id);
                const consultDoesNotHaveAppointment = apptForThisConsult === undefined;
                const consultDateStr = convertEpochToUserTimezoneDate(consult.date);
                // console.log('consultDateStr: ', consultDateStr);
                if (consultDoesNotHaveAppointment || consultDateStr === tomorrowsDateStr) {
                    // if consult does not exists as an appointment
                    // or if the consult that were checking has the same date as tomorrows consult
                    // that means this is either the same consult, or the "consult" wasnt actually a visit, or its a double
                    // if these are true, we dont want to count this visit as the previous visit
                    continue;
                }

                // if we get here we have confirmed a valid last consult for this patient
                dtAppts[i].patientsLastVisitDate = consultDateStr;
                break;
            }

        }

        // if we were unable to find a valid previous visit for this animal, and the owner has other pets,
        // we're going to fetch for those animals' consults
        if (dtAppts[i].patientsLastVisitDate === undefined && otherAnimalsOfContact.length) {
            const otherAnimalIDsOfContact = otherAnimalsOfContact.map(({ animal }) => animal.id);
            const encodedOtherAnimalIDs = encodeURIComponent(JSON.stringify({ "in": otherAnimalIDsOfContact }));
            consultsForOtherContactAnimalsRequests.push(
                bodyForEzyVetGet(`${proxy}/v1/consult?active=1&animal_id=${encodedOtherAnimalIDs}`)
            );
            fetchedForOtherAnimalConsultsArray.push(true);

        }
        else fetchedForOtherAnimalConsultsArray.push(false);
    }

    const contactOtherAnimalsConsultData = fetchAllResponses(
        consultsForOtherContactAnimalsRequests,
        'consults for other animals of contacts where appointment animal has not already visited ua'
    );

    let contactOtherAnimalsConsultDataIndex = 0;
    for (let i = 0; i < dtAppts.length; i++) {
        const didAFetchForConsultsForOtherContactAnimals = fetchedForOtherAnimalConsultsArray[i];
        if (didAFetchForConsultsForOtherContactAnimals) {
            const otherAnimalConsults = contactOtherAnimalsConsultData[contactOtherAnimalsConsultDataIndex++];
            dtAppts[i].otherAnimalConsults = otherAnimalConsults;
        }
    }

    for (let i = 0; i < dtAppts.length; i++) {
        const appt = dtAppts[i];
        const { patientsLastVisitDate, otherAnimalConsults } = appt;
        // both of the above variables will be undefined if the patient has never had an appt AND the owner doesnt have other pets in the system

        if (patientsLastVisitDate) continue; // this means i already have the data i want for the 'first time?' cell
        if (!otherAnimalConsults || !otherAnimalConsults.length) {
            // this means its for sure their first time here
            dtAppts[i].firstTime = true;
            continue;
        }
        
        // otherwise we need to parse through otherAnimalConsults to decide if theyve been here with another pet
        dtAppts[i].itsPossibleTheyveBeenHereWithOtherPets = true;

    }


}

function firstRoundOfFetches(dtAppts) {
    const animalRequests = [];
    const contactRequests = [];
    const allConsultsForAnimalRequests = [];
    const prescriptionRequests = [];
    const animalAttachmentRequests = [];

    dtAppts.forEach(({ appointment }) => {
        const animalID = appointment.details.animal_id;
        animalRequests.push(bodyForEzyVetGet(`${proxy}/v1/animal/${animalID}`));
        contactRequests.push(bodyForEzyVetGet(`${proxy}/v1/contact/${appointment.details.contact_id}`));
        allConsultsForAnimalRequests.push(bodyForEzyVetGet(`${proxy}/v1/consult?active=1&limit=200&animal_id=${animalID}`));
        prescriptionRequests.push(bodyForEzyVetGet(`${proxy}/v1/prescription?active=1&limit=200&animal_id=${animalID}`));
        animalAttachmentRequests.push(bodyForEzyVetGet(`${proxy}/v1/attachment?active=1&limit=200&record_type=Animal&record_id=${animalID}`));
    });

    const animalData = fetchAllResponses(animalRequests, "animal");
    const contactData = fetchAllResponses(contactRequests, "contact");
    const allConsultsForAnimalData = fetchAllResponses(allConsultsForAnimalRequests, "consult");
    const prescriptionData = fetchAllResponses(prescriptionRequests, "prescription");

    for (let i = 0; i < dtAppts.length; i++) {
        const consults = allConsultsForAnimalData[i];
        const consultIDs = consults.map(({ consult }) => consult.id);
        const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": consultIDs }));

        const prescriptions = prescriptionData[i];
        const prescriptionIDs = prescriptions.map(({ prescription }) => prescription.id);

        const newApptData = {
            consults,
            encodedConsultIDs,
            prescriptions,
            prescriptionIDs,
            animal: animalData[i].at(-1).animal,
            contact: contactData[i].at(-1).contact,

        }
        dtAppts[i] = { ...dtAppts[i], ...newApptData };
    }

    const animalAttachmentData = fetchAllResponses(animalAttachmentRequests, "animal attachment");
    return animalAttachmentData;
}

function bodyForEzyVetGet(url) {
    return {
        muteHttpExceptions: true,
        url,
        method: "GET",
        headers: { authorization: token }
    }
};

function jsonParser(input) {
    try {
        const output = JSON.parse(input);
        return output;
    }
    catch {
        return false;
    }
}

async function processRecords(animalAttachmentData, consultAttachmentData, dtAppts, ezyVetFolder) {
    const cdnjs = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
    console.log('loading PDFLib...');
    eval(UrlFetchApp.fetch(cdnjs).getContentText().replace(/setTimeout\(.*?,.*?(\d*?)\)/g, "Utilities.sleep($1);return t();"));
    console.log('loaded PDFLib.');

    for (let i = 0; i < dtAppts.length; i++) {
        const animalName = `${dtAppts[i].animal.name} ${dtAppts[i].contact.last_name}`;
        console.log(`processing records for ${animalName}...`);

        const consultAttachments = consultAttachmentData[i];
        const animalAttachments = animalAttachmentData[i];
        const numOfAttachments = animalAttachments.length + consultAttachments.length;
        console.log(`${animalName} total num of attachments:`, numOfAttachments);

        if (numOfAttachments > 10) {
            dtAppts[i].records = {
                text: 'yes',
            };
            continue;
        }
        if (numOfAttachments < 1) {
            dtAppts[i].records = {
                text: 'no',
                highPriority: true
            };
            continue;
        }

        const fileNameArray = [];
        const attachmentDownloadRequests = [];
        animalAttachments.forEach(({ attachment }) => {
            attachmentDownloadRequests.push(
                bodyForEzyVetGet(`${attachment.file_download_url}`)
            );
            fileNameArray.push(attachment.name);
        });
        consultAttachments.forEach(({ attachment }) => {
            attachmentDownloadRequests.push(
                bodyForEzyVetGet(`${attachment.file_download_url}`)
            );
            fileNameArray.push(attachment.name);
        });

        let attachmentDownloadResponses;
        try {
            console.log(`downloading attachments for ${animalName}`);
            attachmentDownloadResponses = UrlFetchApp.fetchAll(attachmentDownloadRequests);
        }
        catch (error) {
            console.error('error at attachment download fetches: ', error);
            console.error('attachment download bodies: ', attachmentDownloadRequests);
            console.error(`error^^ after trying to dl attachment for ${animalName}`);
        }

        // Utilities.sleep(12000); // to comply with ezyVet's rate limiting
        console.log(`initializing .pdf for ${animalName}...`);
        const mergedPDF = await PDFLib.PDFDocument.create();
        const pdfBytes = await buildPDF(attachmentDownloadResponses, fileNameArray, mergedPDF, animalName);

        console.log(`creating file in drive for ${animalName}'s .pdf`);
        const mergedPDFDriveFile = ezyVetFolder.createFile(
            Utilities.newBlob(
                [...new Int8Array(pdfBytes)],
                MimeType.PDF,
                `${animalName}.pdf`
            )
        );

        const url = mergedPDFDriveFile.getUrl();
        dtAppts[i].records = {
            link: url,
            text: `${attachmentDownloadRequests.length} attachments`
        };
    }
}

async function buildPDF(attachmentDownloadResponses, fileNameArray, mergedPDF, animalName) {
    console.log(`building pdf for ${animalName}...`);

    for (let j = 0; j < attachmentDownloadResponses.length; j++) {
        const fileNameInEzyVet = fileNameArray[j];

        const response = attachmentDownloadResponses[j];
        const blob = response.getBlob();
        const contentType = blob.getContentType();

        console.log(`${fileNameInEzyVet} file type: ${contentType}`);

        const blobByes = new Uint8Array(blob.getBytes());

        if (contentType === 'application/pdf') {
            const pdfData = await PDFLib.PDFDocument.load(blobByes);
            const pages = await mergedPDF.copyPages(
                pdfData,
                Array(pdfData.getPageCount()).fill().map((_, ind) => ind)
            );
            pages.forEach(page => mergedPDF.addPage(page));
        }

        else if (contentType === 'image/jpeg') {
            const image = await mergedPDF.embedJpg(blobByes);
            const imageSize = image.scale(1);
            const page = mergedPDF.addPage([imageSize.width, imageSize.height]);
            page.drawImage(image);
        }

        else if (contentType === 'application/json') {
            const jsonData = JSON.parse(response.getContentText());
            console.log('JSON data:', jsonData);
            const page = mergedPDF.addPage();
            const fontSize = 16;
            page.setFontSize(fontSize);
            const textY = page.getHeight() - 50;
            page.drawText(
                `Error downloading the attachment called "${fileNameInEzyVet}"`,
                { y: textY }
            );
        }
    }

    console.log(`saving .pdf for ${animalName}...`);
    const bytes = await mergedPDF.save();
    console.log(`saved pdf for ${animalName}`)
    return bytes;
}

function fetchAllResponses(requests, resourceName) {
    let outputItems = [];

    try {
        console.log(`getting all ${resourceName} data...`);
        const responses = UrlFetchApp.fetchAll(requests);

        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const contentText = response.getContentText();
            const data = jsonParser(contentText);

            if (!data || response.getResponseCode() !== 200) {
                console.error(`Content text for error at index ${i} fetching ${resourceName} data:`, contentText);
                console.error(`All ${resourceName} Requests:`, requests);
                outputItems = [];
                break;
            }

            outputItems.push(data.items);
        }
    }

    catch (error) {
        console.error(`Error fetching ${resourceName} data:`, error);
        console.error(`${resourceName} Requests:`, requests);
        outputItems = [];
    }

    return outputItems;
}

function driveFolderProcessing(tomorrowsDateStr) {
    const folderNamePrefix = 'ezyVet-attachments-';
    console.log('getting drive folders...');
    const rootFolders = DriveApp.getFolders();

    console.log('trashing old ezyvet folders...');
    while (rootFolders.hasNext()) {
        const folder = rootFolders.next();
        const folderName = folder.getName();
        if (folderName.includes(folderNamePrefix)) {
            folder.setTrashed(true);
        }
    }

    console.log(`creating new drive folder for ${tomorrowsDateStr}...`);
    const ezyVetFolder = DriveApp.createFolder(folderNamePrefix + tomorrowsDateStr);
    ezyVetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

    return ezyVetFolder;
}

function secondRoundOfFetches(dtAppts) {
    const consultAttachmentRequests = [];
    const prescriptionItemRequests = [];
    const animalsOfContactRequests = [];

    for (const appt of dtAppts) {
        consultAttachmentRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=${appt.encodedConsultIDs}`)
        );
        const encodedPrescriptionIDs = encodeURIComponent(JSON.stringify({ "in": appt.prescriptionIDs }));
        prescriptionItemRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/prescriptionitem?active=1&limit=200&prescription_id=${encodedPrescriptionIDs}`)
        );
        animalsOfContactRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/animal?active=1&contact_id=${appt.contact.id}&limit=200`)
        );
    }

    const prescriptionItemData = fetchAllResponses(prescriptionItemRequests, 'prescription item');
    const animalsOfContactData = fetchAllResponses(animalsOfContactRequests, 'animals of contact');

    for (let i = 0; i < dtAppts.length; i++) {
        const prescriptionItems = prescriptionItemData[i];
        const animalsOfContact = animalsOfContactData[i];
        const otherAnimalsOfContact = animalsOfContact.filter(({ animal }) => animal.id !== dtAppts[i].animal.id);

        const newApptData = { prescriptionItems, otherAnimalsOfContact };

        dtAppts[i] = { ...dtAppts[i], ...newApptData };
    }

    const consultAttachmentData = fetchAllResponses(consultAttachmentRequests, 'consult attachment');
    return consultAttachmentData;
};

function processPrescriptionItems(prescriptions, prescriptionItems) {
    const gabaProductIDSet = new Set(['794', '1201', '1249', '5799', '1343']);
    const trazProductIDSet = new Set(['1244', '950']);

    let sedativeName;
    let sedativeDateLastFilled = -Infinity;

    for (const { prescriptionitem } of prescriptionItems) {
        const productID = prescriptionitem.product_id;

        if (gabaProductIDSet.has(productID)) {
            const rxDate = getRxDate(prescriptions, prescriptionitem.prescription_id);
            if (rxDate > sedativeDateLastFilled) {
                sedativeName = 'gabapentin';
                sedativeDateLastFilled = rxDate;
            }

        }
        else if (trazProductIDSet.has(productID)) {
            const rxDate = getRxDate(prescriptions, prescriptionitem.prescription_id);
            if (rxDate > sedativeDateLastFilled) {
                sedativeName = 'trazadone';
                sedativeDateLastFilled = rxDate;
            }
        }
    }

    return { sedativeName, sedativeDateLastFilled };
};

function getRxDate(prescriptions, prescriptionID) {
    const rx = prescriptions.find(({ prescription }) => {
        return prescription.id === prescriptionID;
    });
    return Number(rx.prescription.date_of_prescription);
}

function putDataOnSheet(dtAppts, range, tomorrowsDateStr) {
    const dateCell = range.offset(-2, 0, 1, 1);
    dateCell.setValue(tomorrowsDateStr);

    for (let i = 0; i < dtAppts.length; i++) {
        const {
            appointment,
            contact,
            animal,
            prescriptions,
            prescriptionItems,
            consults,
            encodedConsultIDs,
            patientsLastVisitDate,
            firstTime,
            otherAnimalsOfContact,
            itsPossibleTheyveBeenHereWithOtherPets,
            records
        } = dtAppts[i];

        // time and reason cell are handled the same whether or not the appointment has an unmatched contact/animal record
        const time = convertEpochToUserTimezone(appointment.start_time);
        const timeCell = range.offset(i, 0, 1, 1);
        timeCell.setValue(time);

        const reasonCell = range.offset(i, 2, 1, 1);
        let descriptionString = appointment.details.description;
        if (descriptionString.startsWith('VETSTORIA')) {
            const itemsInParentheses = descriptionString.match(/\((.*?)\)/g);
            const lastItem = itemsInParentheses.at(-1);
            descriptionString = lastItem.slice(1, -1); // remove parentheses
        }
        reasonCell.setValue(descriptionString);


        const ptCell = range.offset(i, 1, 1, 1);
        if (contact.id === '72038') { // if its an unmatched vetstoria record
            handleUnmatchedRecord(appointment, ptCell);
            continue;
        }

        // if we know the animal/contact stuff, continue normally
        const unknownSpeciesString = 'unknown species';
        const ptSpecies = speciesMap[animal.species_id] || unknownSpeciesString;
        if (ptSpecies === unknownSpeciesString) {
            ptCell.setBackground(highPriorityColor);
        }
        const ptText = `${animal.name} ${contact.last_name} (${ptSpecies})`;
        const animalURL = `${sitePrefix}/?recordclass=Animal&recordid=${animal.id}`;
        const link = makeLink(ptText, animalURL);
        ptCell.setRichTextValue(link);

        const firstTimeHereCell = range.offset(i, 3, 1, 1);
        if (firstTime) {
            firstTimeHereCell.setValue('yes').setBackground(highPriorityColor);
        }
        else if (patientsLastVisitDate) {
            firstTimeHereCell.setValue(`pt's last visit: ${patientsLastVisitDate}`);
        }
        else if (itsPossibleTheyveBeenHereWithOtherPets) {
            firstTimeHereCell.setValue(`first time for ${animal.name} but possible theyve been in with other pets...`)
        }
        // we still need to parse through otherAnimalConsults in fetchDataToCheckIfFirstTime()

        const recordsCell = range.offset(i, 4, 1, 1);
        records.link
            ? recordsCell.setRichTextValue(
                makeLink(records.text, records.link)
            )
            : recordsCell.setValue(records.text);
        if (records.highPriority) {
            recordsCell.setBackground(highPriorityColor);
        }


        const hxFractiousCell = range.offset(i, 5, 1, 1);
        animal.is_hostile === '1'
            ? hxFractiousCell.setValue('yes').setBackground(highPriorityColor)
            : hxFractiousCell.setValue('no');


        const { sedativeName, sedativeDateLastFilled } = processPrescriptionItems(prescriptions, prescriptionItems);
        const hasSedCell = range.offset(i, 6, 1, 1);
        const sedCellVal = sedativeName === undefined
            ? 'no'
            : `${sedativeName} last filled ${convertEpochToUserTimezoneDate(sedativeDateLastFilled)}`;
        hasSedCell.setValue(sedCellVal);
    }
}

function handleUnmatchedRecord(appointment, ptCell) {
    const descriptionString = appointment.details.description;
    [_, wonkyAnimalData, contactName, emailAndPhone] = descriptionString.split(' - ');
    const [email, phone] = emailAndPhone.split(" ");
    const animalName = wonkyAnimalData.split(') ')[1];
    ptCell.setValue(`UNMATCHED PATIENT/CLIENT:\n${animalName}\n${contactName}\n${email}\n${phone}`);
    ptCell.setBackground(highPriorityColor);

    let columnDistFromPtCell = 2;
    while (columnDistFromPtCell <= 5) {
        ptCell.offset(0, columnDistFromPtCell++)
            .setValue('-');
    }

    return;
}