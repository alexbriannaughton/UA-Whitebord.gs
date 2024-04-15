const highPriorityColor = '#ffff00';

async function getTomorrowsDTAppts() {
  console.log('running getTomrrowsDTAppts job...');
  const [tomorrowStart, tomorrowEnd] = epochRangeForTomorrow();
  const dateStr = convertEpochToUserTimezoneDate(tomorrowStart);
  console.log('querying for tomorrows appointments...')
  const url = `${proxy}/v1/appointment?active=1&time_range_start=${tomorrowStart}&time_range_end=${tomorrowEnd}&limit=200`;
  const allOfTomorrowsAppts = fetchAndParse(url);
  const dtAppts = filterAndSortDTAppts(allOfTomorrowsAppts);
  await getAllEzyVetData(dtAppts, dateStr);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DT Next Day Checklist');
  const range = sheet.getRange(`A4:H204`)
  range.clearContent()
    .setWrap(true)
    .setFontColor("black")
    .setBackground("white")
    .setFontLine("none");

  putDataOnSheet(dtAppts, range, dateStr);
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

  return dtAppts.sort((a, b) => a.appointment.start_time - b.appointment.start_time)
    .slice(0, 3); // slicing for dev
}

// get the animal, contact and attachment data associated with the appointment
async function getAllEzyVetData(dtAppts, dateStr) {
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

  let animalResponses, contactResponses, animalAttachmentResponses, allConsultsForAnimalResponses, prescriptionResponses;
  try {
    console.log('getting all animal data...');
    animalResponses = UrlFetchApp.fetchAll(animalRequests);
  } catch (error) {
    console.error("Error fetching animal data:", error);
    console.error("Animal Requests:", animalRequests);
  }

  try {
    console.log('getting all contact data...');
    contactResponses = UrlFetchApp.fetchAll(contactRequests);
  } catch (error) {
    console.error("Error fetching contact data:", error);
    console.error("Contact Requests:", contactRequests);
  }

  try {
    console.log('getting all animal attachments...');
    animalAttachmentResponses = UrlFetchApp.fetchAll(animalAttachmentRequests);
  } catch (error) {
    console.error("Error fetching animal attachment data:", error);
    console.error("Animal Attachment Requests:", animalAttachmentRequests);
  }

  try {
    console.log('getting data for consults for each animal...');
    allConsultsForAnimalResponses = UrlFetchApp.fetchAll(allConsultsForAnimalRequests);
  } catch (error) {
    console.error("Error fetching consult data:", error);
    console.error("All Consults Requests:", allConsultsForAnimalRequests);
  }

  try {
    console.log('getting all prescriptions data...')
    prescriptionResponses = UrlFetchApp.fetchAll(prescriptionRequests);
  } catch (error) {
    console.error("Error fetching prescription data:", error);
    console.error("Prescription Requests:", prescriptionRequests);
  }


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
  console.log(`creating new drive folder for ${dateStr}...`);
  const ezyVetFolder = DriveApp.createFolder(folderNamePrefix + dateStr);
  ezyVetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

  const consultAttachmentRequests = [];
  const prescriptionItemRequests = [];
  const animalsOfContactRequests = [];
  for (const appt of dtAppts) {
    const encodedConsultIDs = encodeURIComponent(JSON.stringify({ "in": appt.consultIDs }));
    consultAttachmentRequests.push(
      bodyForEzyVetGet(`${proxy}/v1/attachment?limit=200&active=1&record_type=Consult&record_id=${encodedConsultIDs}`)
    );
    const encodedPrescriptionIDs = encodeURIComponent(JSON.stringify({ "in": appt.prescriptionIDs }));
    prescriptionItemRequests.push(
      bodyForEzyVetGet(`${proxy}/v1/prescriptionitem?active=1&limit=200&prescription_id=${encodedPrescriptionIDs}`)
    );
    animalsOfContactRequests.push(
      bodyForEzyVetGet(`${proxy}/v1/animal?active=1&contact_id=${appt.contact.id}&limit=200`)
    );
  }
  let consultAttachmentResponses, prescriptionItemResponses, animalsOfContactResponses;
  try {
    console.log(`getting consult attachments...`);
    consultAttachmentResponses = UrlFetchApp.fetchAll(consultAttachmentRequests);
  } catch (error) {
    console.error("Error fetching consult attachment data:", error);
    console.error("Consult Attachments Requests:", consultAttachmentRequests);
  }

  try {
    console.log('getting prescription items...')
    prescriptionItemResponses = UrlFetchApp.fetchAll(prescriptionItemRequests);
  } catch (error) {
    console.error("Error fetching prescription item data:", error);
    console.error("Prescription Item Requests:", prescriptionItemRequests);
  }

  try {
    console.log(`getting animals of contact...`);
    animalsOfContactResponses = UrlFetchApp.fetchAll(animalsOfContactRequests);
  } catch (error) {
    console.error("Error fetching consult attachment data:", error);
    console.error("Animals of contacts requests:", animalsOfContactRequests);
  }


  const cdnjs = "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
  console.log('loading PDFLib...');
  eval(UrlFetchApp.fetch(cdnjs).getContentText().replace(/setTimeout\(.*?,.*?(\d*?)\)/g, "Utilities.sleep($1);return t();"));

  for (let i = 0; i < animalAttachmentResponses.length; i++) {
    const animalName = `${dtAppts[i].animal.name} ${dtAppts[i].contact.last_name}`;

    const prescriptionItemResponse = prescriptionItemResponses[i];
    const prescriptionItems = JSON.parse(prescriptionItemResponse.getContentText()).items;
    dtAppts[i].prescriptionItems = prescriptionItems;

    const animalsOfContactResponse = animalsOfContactResponses[i];
    const animalsOfContact = JSON.parse(animalsOfContactResponse.getContentText()).items;
    const animalIDsOfContact = animalsOfContact.map(({ animal }) => animal.id);
    dtAppts[i].animalIDsOfContact = animalIDsOfContact;

    const animalAttachmentResponse = animalAttachmentResponses[i];
    const animalAttachments = JSON.parse(animalAttachmentResponse.getContentText()).items;
    const consultAttachmentsResponse = consultAttachmentResponses[i];
    const consultAttachments = JSON.parse(consultAttachmentsResponse.getContentText()).items;
    console.log(`${animalName} consult attachments:`, consultAttachments);
    console.log(`${animalName} animal attachments:`, animalAttachments);
    const numOfAttachments = animalAttachments.length + consultAttachments.length;
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
      console.log('error at attachment download fetches: ', error);
      console.log('attachment download bodies: ', attachmentDownloadRequests);
      console.log(`error^^ after trying to dl attachment for ${animalName}`);
      dtAppts[i].records = "error when trying to download these records.";
      continue;
    }

    // Utilities.sleep(12000); // to comply with ezyVet's rate limiting
    console.log(`building .pdf for ${animalName}`);
    const mergedPDF = await PDFLib.PDFDocument.create();
    for (let j = 0; j < attachmentDownloadResponses.length; j++) {
      const response = attachmentDownloadResponses[j];
      const blob = response.getBlob();
      console.log(`${animalName}`, 'blob:');
      console.log('content type: ', blob.getContentType());
      const name = blob.getName();
      console.log('name: ', name);
      const blobByes = new Uint8Array(blob.getBytes());

      if (name.includes('.pdf')) {
        const pdfData = await PDFLib.PDFDocument.load(blobByes);
        const pages = await mergedPDF.copyPages(
          pdfData,
          [...Array(pdfData.getPageCount())].map((_, ind) => ind)
        );
        pages.forEach(page => mergedPDF.addPage(page));
      }

      else if (name.includes('.jpg') || name.includes('.jpeg')) {
        const image = await mergedPDF.embedJpg(blobByes);
        const imageSize = image.scale(1);
        const page = mergedPDF.addPage([imageSize.width, imageSize.height]);
        page.drawImage(image);
      }

      else if (name.endsWith('.json')) {
        const jsonData = JSON.parse(response.getContentText());
        console.log('JSON data:', jsonData);
        const fileNameInEzyVet = fileNameArray[j];
        const page = mergedPDF.addPage();
        page.drawText(`💀Error downloading the file called ${fileNameInEzyVet}💀`);
      }

    }
    console.log(`saving .pdf for ${animalName}`);
    const bytes = await mergedPDF.save();
    console.log(`creating file in drive for ${animalName}'s .pdf`);
    const mergedPDFDriveFile = ezyVetFolder.createFile(
      Utilities.newBlob(
        [...new Int8Array(bytes)],
        MimeType.PDF,
        `${animalName}.pdf`
      )
    );
    const url = mergedPDFDriveFile.getUrl();
    dtAppts[i].records = {
      link: url,
      text: `maybe`
    };
  };

  const consultsForAllContactAnimalRequests = [];
  const contactHasOtherAnimalsArray = [];
  for (const appt of dtAppts) {
    if (appt.animalIDsOfContact.length > 1) {
      const encodedAnimalIDs = encodeURIComponent(JSON.stringify({ "in": appt.animalIDsOfContact }));
      consultsForAllContactAnimalRequests.push(
        bodyForEzyVetGet(`${proxy}/v1/consult?active=1&animal_id=${encodedAnimalIDs}`)
      );
      contactHasOtherAnimalsArray.push(true);
    }
    else contactHasOtherAnimalsArray.push(false);
  }
  let consultsForAllContactAnimalResponses;
  try {
    console.log('getting consults for all contact animals...')
    consultsForAllContactAnimalResponses = UrlFetchApp.fetchAll(consultsForAllContactAnimalRequests);
  } catch (error) {
    console.error("Error fetching prescription item data:", error);
    console.error("Consults For All Contact Animal Requests", consultsForAllContactAnimalRequests);
  }

  let hasOtherAnimalsArrayIndex = 0;
  for (let i = 0; i < dtAppts.length; i++) {
    const didAFetchForConsultsForAllContactAnimals = contactHasOtherAnimalsArray[i];
    if (didAFetchForConsultsForAllContactAnimals) {
      const consultsForAllContactAnimalResponse = consultsForAllContactAnimalResponses[hasOtherAnimalsArrayIndex++];
      const consultsForAllContactAnimals = JSON.parse(consultsForAllContactAnimalResponse.getContentText()).items;
      dtAppts[i].ownerHasBeenHereWithAnotherPatient = consultsForAllContactAnimals.length > 0;
    }
    else dtAppts[i].ownerHasBeenHereWithAnotherPatient = false;
  }
}

function bodyForEzyVetGet(url) {
  return {
    // muteHttpExceptions: true,
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

function putDataOnSheet(dtAppts, range, dateStr) {
  const dateCell = range.offset(-2, 0, 1, 1);
  dateCell.setValue(dateStr);

  for (let i = 0; i < dtAppts.length; i++) {
    const {
      appointment,
      contact,
      animal,
      prescriptions,
      prescriptionItems,
      consultIDs,
      ownerHasBeenHereWithAnotherPatient,
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
    const ptSpecies = speciesMap[animal.species_id] || 'unknown species';
    const ptText = `${animal.name} ${contact.last_name} (${ptSpecies})`;
    const animalURL = `${sitePrefix}/?recordclass=Animal&recordid=${animal.id}`;
    const link = makeLink(ptText, animalURL);
    ptCell.setRichTextValue(link);

    const firstTimeHereCell = range.offset(i, 3, 1, 1);
    const animalHasBeenHere = consultIDs.length > 2;
    if (animalHasBeenHere === true) {
      firstTimeHereCell.setValue('no');
    }
    // else this is the animal's first time here...
    else if (ownerHasBeenHereWithAnotherPatient === false) {
      firstTimeHereCell.setValue('yes').setBackground(highPriorityColor);
    }
    else if (ownerHasBeenHereWithAnotherPatient === true) {
      firstTimeHereCell.setValue(`O has brought other pets--first time for ${animal.name}.`);
    }

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
  ptCell.setValue(`
  UNMATCHED PATIENT/CLIENT:\n
  ${animalName}\n
  ${contactName}\n${email}\n
  ${phone}
  `);
  ptCell.setBackground(highPriorityColor);

  let columnDistFromPtCell = 2;
  while (columnDistFromPtCell <= 5) {
    ptCell.offset(0, columnDistFromPtCell++)
      .setValue('-');
  }

  return;
}