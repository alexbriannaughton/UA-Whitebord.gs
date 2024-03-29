function getTomorrowsDTAppts() {
    const [tomorrowStart, tomorrowEnd] = epochRangeForTomorrow();
    // send query for all appointments for tomorrow
    const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
    const allOfTomorrowsAppts = fetchAndParse(url);
    const dtAppts = filterAndSortDTAppts(allOfTomorrowsAppts);
    getAllEzyVetData(dtAppts);

    console.log('dtappts:', dtAppts)

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
    const range = sheet.getRange(`A4:C204`)
    range.clearContent();
    range.setWrap(true);

    for (let i = 0; i < dtAppts.length; i++) {
        const {
            appointment,
            contact,
            animal,
            consultAttachments,
            animalAttachments,
            attachmentDriveURLs
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

        const recordsCell = range.offset(i, 4, 1, 1);
        let linkText = '';
        for (let j = 0; j < attachmentDriveURLs.length; j++) {
            linkText += `link ${j + 1},`;
        }
        const value = SpreadsheetApp.newRichTextValue().setText(linkText);
        let prevCharEnd = 0;
        for (let j = 0; j < attachmentDriveURLs.length; j++) {
            value.setLinkUrl(prevCharEnd, prevCharEnd + 7, attachmentDriveURLs[j]);
            prevCharEnd += 7;
        };
        recordsCell.setRichTextValue(value.build());
    }
};

function filterAndSortDTAppts(allOfTomorrowsAppts) {
    // filter all appts down to DT exams and techs
    const dtResourceIDs = new Set([ // non procedures dt columns
        '35', // dt dvm 1
        '55', // used to be dt dvm 2, though it is not currently active 3/16/24
        '56', // dt tech
        '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
        '1082' // dt DVM :15/:45
    ]);
    const dtAppts = allOfTomorrowsAppts.items.filter(({ appointment }) => {
        return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in a DT exam or tech column
            && appointment.details.appointment_type_id !== '4'; // is not a blocked off spot
    });

    return dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time)
        .slice(0, 2); // for dev we are just slicing the first two
}

// get the animal, contact and attachment data associated with the appointment
function getAllEzyVetData(dtAppts) {
    const animalRequests = [];
    const contactRequests = [];
    const animalAttachmentRequests = [];
    const allConsultsForAnimalRequests = [];
    dtAppts.forEach(({ appointment }) => {
        animalRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/animal/${appointment.details.animal_id}`)
        );
        contactRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/contact/${appointment.details.contact_id}`)
        );
        animalAttachmentRequests.push(
            bodyForEzyVetGet(
                `${proxy}/v1/attachment?active=1&limit=200&record_type=Animal&record_id=${appointment.details.animal_id}`
            )
        );
        allConsultsForAnimalRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/consult?active=1&limit=200&animal_id=${appointment.details.animal_id}`)
        );
    });

    const animalResponses = UrlFetchApp.fetchAll(animalRequests);
    const contactResponses = UrlFetchApp.fetchAll(contactRequests);
    const animalAttachmentResponses = UrlFetchApp.fetchAll(animalAttachmentRequests);
    const allConsultsForAnimalResponses = UrlFetchApp.fetchAll(allConsultsForAnimalRequests);

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

    // start dealing with attachment stuff
    const ezyvetFolder = DriveApp.getFoldersByName('ezyVet-attachments').next();

    const consultAttachmentRequests = [];
    for (const appt of dtAppts) {
        const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": appt.consultIDs }));
        consultAttachmentRequests.push(
            bodyForEzyVetGet(`${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=${encodedConsultIDs}`)
        );
    }
    const consultAttachmentResponses = UrlFetchApp.fetchAll(consultAttachmentRequests);

    animalAttachmentResponses.forEach((response, i) => {
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
        const attachmentDriveURLs = []
        attachmentDownloadResponses.forEach(response => {
            const blob = response.getBlob();
            const fileName = blob.getName();
            const existingFiles = ezyvetFolder.getFilesByName(fileName); // returns FileIterator object
            const driveFile = existingFiles.hasNext() // if the file exists
                ? existingFiles.next() // use it
                : ezyvetFolder.createFile(blob); // otherwise create it in Drive, and use that
            const url = driveFile.getUrl();
            attachmentDriveURLs.push(url);
        });
        dtAppts[i].attachmentDriveURLs = attachmentDriveURLs;
    });
}

function bodyForEzyVetGet(url) {
    return {
        muteHttpExceptions: true,
        url,
        method: "GET",
        headers: { authorization: token }
    }
};

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
    const html = HtmlService.createHtmlOutput('<script>window.open("' + fileUrl + '");</script>');
    SpreadsheetApp.getUi().showModalDialog(html, 'Opening PDF...');
    return;
}