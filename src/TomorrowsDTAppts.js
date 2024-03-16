function downloadPdfToDrive() {
  const dlLink = 'https://urbananimalnw.usw2.ezyvet.com/api/v1/attachment/download/4425719970';
  const cache = CacheService.getScriptCache();
  let token = cache.get('ezyVet_token');

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

function getTomorrowsDTAppts() {
  // get epochs for range of tomorrow
  const now = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 2); // Move to tomorrow
  const tomorrowStart = Math.floor(tomorrow.setHours(0, 0, 0, 0) / 1000); // midnight tomorrow in seconds
  const tomorrowEnd = Math.floor(tomorrow.setHours(23, 59, 59, 999) / 1000); // end of tomorrow in seconds
  // send query for all appointments for tomorrow
  const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
  const allOfTomorrowsAppts = fetchAndParse(url);

  // filter all appts down to DT exams and techs
  const dtResourceIDs = new Set([ // non procedures dt columns
    '35', // dt dvm 1
    '55', // used to be dt dvm 2, though it is not currently active 3/16/24
    '56', // dt tech
    '1015', // used to be dt dvm 3, though it is not currently active 3/16/24
    '1082' // dt DVM :15/:45
  ]); 
  const dtAppts = allOfTomorrowsAppts.items.filter(({ appointment }) => {
    return appointment.details.resource_list.some(id => dtResourceIDs.has(id)) // is in DT exam or tech column
      && appointment.details.appointment_type_id !== '4'; // is not a blocked off spot
  });

  dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time);

  const firstTwoApptsForTesting = dtAppts.slice(0, 2); // for prod we will use dtAppts instead
  const allDTApptData = getAllEzyVetData(firstTwoApptsForTesting);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
  const range = sheet.getRange(`A4:C204`)
  range.clearContent();

  for (let i = 0; i < dtAppts.length; i++) {
    const {
      appointment,
      contact,
      animal,
      consultAttachments,
      animalAttachments
    } = dtAppts[i];

    console.log(dtAppts[i]);

    const time = convertEpochToSeattleTime(appointment.start_time);
    const timeCell = range.offset(i, 0, 1, 1);
    timeCell.setValue(time);

    // const ptCell = range.offset(i, 1, 1, 1);
    // const reasonCell = range.offset(i, 2, 1, 1);
    // const patientText = `${animalName} ${contactLastName} (${animalSpecies})`;
    // const webAddress = `${sitePrefix}/?recordclass=Animal&recordid=${appointment.details.animal_id}`
    // const link = makeLink(patientText, webAddress);
    // ptCell.setRichTextValue(link);
    // reasonCell.setValue(appointment.details.description);
  }
}

// get the animal, contact and attachment data associated with the appointment
function getAllEzyVetData(dtAppts) {
  let animalRequests = [];
  let contactRequests = [];
  let animalAttachmentRequests = [];
  let allConsultsForAnimalRequests = [];
  dtAppts.forEach(({ appointment }) => {
    animalRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/animal/${appointment.details.animal_id}`,
      method: "GET",
      headers: { authorization: token }
    });
    contactRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/contact/${appointment.details.contact_id}`,
      method: "GET",
      headers: { authorization: token }
    });
    animalAttachmentRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/attachment?active=1&limit=200&record_type=Animal&record_id=${appointment.details.animal_id}`,
      method: "GET",
      headers: { authorization: token }
    });
    allConsultsForAnimalRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/consult?active=1&limit=200&animal_id=${appointment.details.animal_id}`,
      method: "GET",
      headers: { authorization: token }
    })
  });

  let animalResponses = UrlFetchApp.fetchAll(animalRequests);
  let contactResponses = UrlFetchApp.fetchAll(contactRequests);
  let animalAttachmentResponses = UrlFetchApp.fetchAll(animalAttachmentRequests);
  let allConsultsForAnimalResponses = UrlFetchApp.fetchAll(allConsultsForAnimalRequests);

  animalResponses.forEach((response, i) => {
    let animal = JSON.parse(response.getContentText()).items.at(-1).animal;
    dtAppts[i].animal = animal;
  });
  contactResponses.forEach((response, i) => {
    let contact = JSON.parse(response.getContentText()).items.at(-1).contact;
    dtAppts[i].contact = contact;
  });
  animalAttachmentResponses.forEach((response, i) => {
    let attachments = JSON.parse(response.getContentText()).items;
    dtAppts[i].animalAttachments = attachments;
  });
  allConsultsForAnimalResponses.forEach((response, i) => {
    let consults = JSON.parse(response.getContentText()).items;
    const consultIDs = consults.map(({ consult }) => consult.id);
    dtAppts[i].consultIDs = consultIDs;
  });

  const consultAttachmentRequests = [];
  for (const appt of dtAppts) {
    if (!appt.consultIDs) {
      console.log('dont request past the first two appointments');
      break;
    }
    const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": appt.consultIDs }));
    consultAttachmentRequests.push({
      muteHttpExceptions: true,
      url: `${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=${encodedConsultIDs}`,
      method: "GET",
      headers: { authorization: token }
    })
  }
  const consultAttachmentResponses = UrlFetchApp.fetchAll(consultAttachmentRequests);

  consultAttachmentResponses.forEach((response, i) => {
    const attachments = JSON.parse(response.getContentText()).items;
    dtAppts[i].consultAttachments = attachments;
  });

  dtAppts.forEach(appt => {
    console.log('APPOINTMENT ', appt.appointment.id);
    console.log('appointment details: ', appt.appointment.details);
    console.log('animal: ', appt.animal);
    console.log('contact', appt.contact);
    console.log('animalAttachments: ', appt.animalAttachments);
    console.log('consultAttachments: ', appt.consultAttachments);
  })

  return dtAppts;
}