// PutDataOnSheet.js
const highPriorityColor = '#ffff00'; // for highlighting certain items in yellow

function putDataOnSheet(dtAppts, range, tomorrowsDateStr, dayOfWeekString) {
    const dateCell = range.offset(-2, 0, 1, 1);
    dateCell.setValue(`${dayOfWeekString} ${tomorrowsDateStr}`);

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
            firstTimeHereCell.setValue(`${animal.name}'s last visit: ${patientsLastVisitDate}`);
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