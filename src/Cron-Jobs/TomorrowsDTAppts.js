async function getTomorrowsDTAppts() {
    const [tomorrowStart, tomorrowEnd] = epochRangeForTomorrow();
    // send query for all appointments for tomorrow
    const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
    const allOfTomorrowsAppts = fetchAndParse(url);
    const dtAppts = filterAndSortDTAppts(allOfTomorrowsAppts);
    await getAllEzyVetData(dtAppts);

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
    const range = sheet.getRange(`A4:C204`)
    range.clearContent();
    range.setWrap(true);

    putDataOnSheet(dtAppts, range);

    // for (let i = 0; i < dtAppts.length; i++) {
    //     const {
    //         appointment,
    //         contact,
    //         animal,
    //         prescriptions,
    //         prescriptionItems,
    //         consultIDs,
    //         recordsURL
    //     } = dtAppts[i];

    //     const time = convertEpochToUserTimezone(appointment.start_time);
    //     const timeCell = range.offset(i, 0, 1, 1);
    //     timeCell.setValue(time);

    //     const ptCell = range.offset(i, 1, 1, 1);
    //     const ptSpecies = speciesMap[animal.species_id] || 'unknown species';
    //     const ptText = `${animal.name} ${contact.last_name} (${ptSpecies})`;
    //     const animalURL = `${sitePrefix}/?recordclass=Animal&recordid=${animal.id}`;
    //     const link = makeLink(ptText, animalURL);
    //     ptCell.setRichTextValue(link);

    //     const reasonCell = range.offset(i, 2, 1, 1);
    //     let descriptionString = appointment.details.description;
    //     if (descriptionString.startsWith('VETSTORIA')) {
    //         const itemsInParentheses = descriptionString.match(/\((.*?)\)/g);
    //         const lastItem = itemsInParentheses.at(-1);
    //         descriptionString = lastItem.slice(1, -1); // remove parentheses
    //     }
    //     reasonCell.setValue(descriptionString);

    //     const firstTimeHereCell = range.offset(i, 3, 1, 1);
    //     const yesOrNoForFirstTime = consultIDs.length < 2;
    //     firstTimeHereCell.setValue(yesOrNoForFirstTime);
    //     // TODO:
    //     // check if this is the vetstoria placeholder account
    //     // yes if vetstoria placeholder account OR if consultIDs.length < 2
    //     // this would check if pt's first time. do we want to check O's first time?

    //     const recordsCell = range.offset(i, 4, 1, 1);
    //     recordsCell.setValue(recordsURL);

    //     const hxFractiousCell = range.offset(i, 5, 1, 1);
    //     const yesOrNoForFractious = animal.is_hostile;
    //     hxFractiousCell.setValue(yesOrNoForFractious);

    //     const { sedativeName, sedativeDateLastFilled } = processPrescriptionItems(prescriptions, prescriptionItems);
    //     const hasSedCell = range.offset(i, 6, 1, 1);
    //     const sedCellVal = sedativeName === undefined
    //         ? 'no'
    //         : `${sedativeName} last filled ${convertEpochToUserTimezoneDate(sedativeDateLastFilled)}`;
    //     hasSedCell.setValue(sedCellVal);
    // }
};

function filterAndSortDTAppts(allOfTomorrowsAppts) {
    // filter all appts down to DT exams/techs
    const dtResourceIDs = new Set([ // non procedures dt columns
        '35', // dt dvm 1
        '55', // used to be dt dvm 2, though it is not currently active 3/16/24
        '56', // dt tech
        '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
        '1082' // dt DVM :15/:45
    ]);
    const dtAppts = allOfTomorrowsAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam or tech column
            && appointment.details.appointment_type_id !== '4'; // & is not a blocked off spot
    });

    return dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time)
        .slice(0, 2); // for dev we are just slicing the first two
}

// get the animal, contact and attachment data associated with the appointment
async function getAllEzyVetData(dtAppts) {
    const animalRequests = [];
    const contactRequests = [];
    const animalAttachmentRequests = [];
    const allConsultsForAnimalRequests = [];
    const prescriptionRequests = [];
    dtAppts.forEach(({ appointment }) => {
        const animalID = appointment.details.animal_id;
        animalRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/animal/${animalID}`)
        );
        contactRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/contact/${appointment.details.contact_id}`)
        );
        animalAttachmentRequests.push(
            bodyForEzyVetGet(
                `${proxy}/v1/attachment?active=1&limit=200&record_type=Animal&record_id=${animalID}`
            )
        );
        allConsultsForAnimalRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/consult?active=1&limit=200&animal_id=${animalID}`)
        );
        prescriptionRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/prescription?active=1&limit=200&animal_id=${animalID}`)
        );
    });

    const animalResponses = UrlFetchApp.fetchAll(animalRequests);
    const contactResponses = UrlFetchApp.fetchAll(contactRequests);
    const animalAttachmentResponses = UrlFetchApp.fetchAll(animalAttachmentRequests);
    const allConsultsForAnimalResponses = UrlFetchApp.fetchAll(allConsultsForAnimalRequests);
    const prescriptionResponses = UrlFetchApp.fetchAll(prescriptionRequests);

    animalResponses.forEach((response, i) => {
        const { animal } = JSON.parse(response.getContentText()).items.at(-1);
        dtAppts[i].animal = animal;
    });
    contactResponses.forEach((response, i) => {
        const { contact } = JSON.parse(response.getContentText()).items.at(-1);
        dtAppts[i].contact = contact;
    });
    allConsultsForAnimalResponses.forEach((response, i) => {
        const consults = JSON.parse(response.getContentText()).items;
        const consultIDs = consults.map(({ consult }) => consult.id);
        dtAppts[i].consultIDs = consultIDs;
    });
    prescriptionResponses.forEach((response, i) => {
        const prescriptions = JSON.parse(response.getContentText()).items;
        const prescriptionIDs = prescriptions.map(({ prescription }) => prescription.id);
        dtAppts[i].prescriptions = prescriptions;
        dtAppts[i].prescriptionIDs = prescriptionIDs;
    });

    const ezyvetFolder = DriveApp.getFoldersByName('ezyVet-attachments').next();

    const consultAttachmentRequests = [];
    const prescriptionItemRequests = [];
    for (const appt of dtAppts) {
        const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": appt.consultIDs }));
        consultAttachmentRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=${encodedConsultIDs}`)
        );
        const encodedPrescriptionIDs = encodeURIComponent(JSON.stringify({ "in": appt.prescriptionIDs }));
        prescriptionItemRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/prescriptionitem?active=1&limit=200&prescription_id=${encodedPrescriptionIDs}`)
        );
    }
    const consultAttachmentResponses = UrlFetchApp.fetchAll(consultAttachmentRequests);
    const prescriptionItemResponses = UrlFetchApp.fetchAll(prescriptionItemRequests);

    const cdnjs = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
    eval(UrlFetchApp.fetch(cdnjs).getContentText().replace(/setTimeout\(.*?,.*?(\d*?)\)/g, "Utilities.sleep($1);return t();"));

    for (let i = 0; i < animalAttachmentResponses.length; i++) {
        const response = animalAttachmentResponses[i];
        const prescriptionItemResponse = prescriptionItemResponses[i];
        const prescriptionItems = JSON.parse(prescriptionItemResponse.getContentText()).items;
        dtAppts[i].prescriptionItems = prescriptionItems;

        const attachmentDownloadRequests = [];
        const animalAttachments = JSON.parse(response.getContentText()).items;
        animalAttachments.forEach(({ attachment }) => {
            attachmentDownloadRequests.push(
                bodyForEzyVetGet(`${attachment.file_download_url}`)
            );
        });
        dtAppts[i].animalAttachments = animalAttachments;

        const consultAttachmentsResponse = consultAttachmentResponses[i];
        const consultAttachments = JSON.parse(consultAttachmentsResponse.getContentText()).items;
        consultAttachments.forEach(({ attachment }) => {
            attachmentDownloadRequests.push(
                bodyForEzyVetGet(`${attachment.file_download_url}`)
            );
        });
        dtAppts[i].consultAttachments = consultAttachments;
        const attachmentDownloadResponses = UrlFetchApp.fetchAll(attachmentDownloadRequests);


        const mergedPDF = await PDFLib.PDFDocument.create();
        for (let j = 0; j < attachmentDownloadResponses.length; j++) {
            const response = attachmentDownloadResponses[j];
            const blob = response.getBlob();
            const name = blob.getName();
            if (name.includes('.pdf')) {
                const d = new Uint8Array(blob.getBytes());
                const pdfData = await PDFLib.PDFDocument.load(d);
                const pages = await mergedPDF.copyPages(pdfData, [...Array(pdfData.getPageCount())].map((_, i) => i));
                pages.forEach(page => mergedPDF.addPage(page));
            }

            else if (name.includes('.jpg') || name.includes('.jpeg')) {
                const d = new Uint8Array(blob.getBytes());
                const image = await mergedPDF.embedJpg(d);
                const imageSize = image.scale(1);
                const page = mergedPDF.addPage([imageSize.width, imageSize.height]);
                page.drawImage(image);
            }

        }
        const bytes = await mergedPDF.save();

        const animalName = dtAppts[i].animal.name;
        const animalLastName = dtAppts[i].contact.last_name;
        const mergedPDFDriveFile = ezyvetFolder.createFile(
            Utilities.newBlob(
                [...new Int8Array(bytes)],
                MimeType.PDF,
                `${animalName} ${animalLastName}.pdf`
            )
        );
        const url = mergedPDFDriveFile.getUrl();
        dtAppts[i].recordsURL = url;
    };
}

function bodyForEzyVetGet(url) {
    return {
        muteHttpExceptions: true,
        url,
        method: "GET",
        headers: { authorization: token }
    }
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
            console.log('rx date: ', rxDate)
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
}

function getRxDate(prescriptions, prescriptionID) {
    const rx = prescriptions.find(({ prescription }) => {
        return prescription.id === prescriptionID;
    });
    return Number(rx.prescription.date_of_prescription);
}

function putDataOnSheet(dtAppts, range, ) {
    for (let i = 0; i < dtAppts.length; i++) {
        const {
            appointment,
            contact,
            animal,
            prescriptions,
            prescriptionItems,
            consultIDs,
            recordsURL
        } = dtAppts[i];

        const time = convertEpochToUserTimezone(appointment.start_time);
        const timeCell = range.offset(i, 0, 1, 1);
        timeCell.setValue(time);

        const ptCell = range.offset(i, 1, 1, 1);
        const ptSpecies = speciesMap[animal.species_id] || 'unknown species';
        const ptText = `${animal.name} ${contact.last_name} (${ptSpecies})`;
        const animalURL = `${sitePrefix}/?recordclass=Animal&recordid=${animal.id}`;
        const link = makeLink(ptText, animalURL);
        ptCell.setRichTextValue(link);

        const reasonCell = range.offset(i, 2, 1, 1);
        let descriptionString = appointment.details.description;
        if (descriptionString.startsWith('VETSTORIA')) {
            const itemsInParentheses = descriptionString.match(/\((.*?)\)/g);
            const lastItem = itemsInParentheses.at(-1);
            descriptionString = lastItem.slice(1, -1); // remove parentheses
        }
        reasonCell.setValue(descriptionString);

        const firstTimeHereCell = range.offset(i, 3, 1, 1);
        const yesOrNoForFirstTime = consultIDs.length < 2;
        firstTimeHereCell.setValue(yesOrNoForFirstTime);
        // TODO:
        // check if this is the vetstoria placeholder account
        // yes if vetstoria placeholder account OR if consultIDs.length < 2
        // this would check if pt's first time. do we want to check O's first time?

        const recordsCell = range.offset(i, 4, 1, 1);
        recordsCell.setValue(recordsURL);

        const hxFractiousCell = range.offset(i, 5, 1, 1);
        const yesOrNoForFractious = animal.is_hostile;
        hxFractiousCell.setValue(yesOrNoForFractious);

        const { sedativeName, sedativeDateLastFilled } = processPrescriptionItems(prescriptions, prescriptionItems);
        const hasSedCell = range.offset(i, 6, 1, 1);
        const sedCellVal = sedativeName === undefined
            ? 'no'
            : `${sedativeName} last filled ${convertEpochToUserTimezoneDate(sedativeDateLastFilled)}`;
        hasSedCell.setValue(sedCellVal);
    }
}

// the following are functions that ive used for testing
function downloadPdfToDrive() {
    const dlLink = 'https://urbananimalnw.usw2.ezyvet.com/api/v1/attachment/download/4425719970';
    const cache = CacheService.getScriptCache();
    const token = cache.get('ezyVet_token');

    if (!token) {
        token = PropertiesService.getScriptProperties().getProperty('ezyVet_token');
        cache.put('ezyVet_token', token, 300); // Cache the token for 5 minutes (adjust as needed)
    }

    const options = {
        muteHttpExceptions: true,
        method: "GET",
        headers: {
            authorization: token
        }
    };

    let response = UrlFetchApp.fetch(dlLink, options);
    if (response.getResponseCode() === 401) {
        options.headers.authorization = updateToken(cache);
        response = UrlFetchApp.fetch(dlLink, options);
    }

    const blob = response.getBlob();
    const fileName = blob.getName();

    const existingFiles = DriveApp.getFilesByName(fileName); // returns FileIterator object
    const file = existingFiles.hasNext() // if the file exists
        ? existingFiles.next() // use it
        : DriveApp.createFile(blob); // otherwise create it in Drive, and use that

    const fileUrl = file.getUrl();
    const html = HtmlService.createHtmlsedativeName('sedativeDateipt>window.open("' + fileUrl + '");</script>');
    SpreadsheetApp.getUi().showModalDialog(html, 'Opening PDF...');
    return;
}

async function go() {
    const ezyvetFolder = DriveApp.getFoldersByName('ezyVet-attachments').next();
    const files = ezyvetFolder.getFiles();

    const cdnjs = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
    eval(UrlFetchApp.fetch(cdnjs).getContentText().replace(/setTimeout\(.*?,.*?(\d*?)\)/g, "Utilities.sleep($1);return t();"));

    const pdfDoc = await PDFLib.PDFDocument.create();
    while (files.hasNext()) {
        const file = files.next();
        const name = file.getName();

        if (name.includes('.pdf')) {
            const d = new Uint8Array(file.getBlob().getBytes());
            const pdfData = await PDFLib.PDFDocument.load(d);
            const pages = await pdfDoc.copyPages(pdfData, [...Array(pdfData.getPageCount())].map((_, i) => i));
            pages.forEach(page => pdfDoc.addPage(page));
        }

        else if (name.includes('.jpg') || name.includes('.jpeg')) {
            const d = new Uint8Array(file.getBlob().getBytes());
            const image = await pdfDoc.embedJpg(d);
            const imageSize = image.scale(1); // No scaling, keep original size
            const page = pdfDoc.addPage([imageSize.width, imageSize.height]); // Create page with same size as image
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: imageSize.width,
                height: imageSize.height,
            });
        }
    }
    const bytes = await pdfDoc.save();

    // Create a PDF file.
    DriveApp.createFile(Utilities.newBlob([...new Int8Array(bytes)], MimeType.PDF, "sample2.pdf"));
}