// PutDataOnSheet.js
const highPriorityColor = '#ffff00'; // for highlighting certain items in yellow
const unmatchedVetstoriaContactID = '72038';
function putDataOnSheet(dtAppts, range, targetDateStr) {
    const dateCell = range.offset(-2, 0, 1, 1);
    dateCell.setValue(
        `DVM visits for ${targetDateStr}`
    );

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
            otherAnimalsWhoHaveBeenHere,
            records
        } = dtAppts[i];

        // time and reason cell are handled the same whether or not the appointment has an unmatched contact/animal record
        const timeCellVal = getTimeCellValue(i, appointment.start_time, contact.id, dtAppts);
        const timeCell = range.offset(i, 0, 1, 1);
        timeCell.setValue(timeCellVal);

        const reasonCell = range.offset(i, 3, 1, 1);
        const descriptionString = removeVetstoriaDescriptionText(appointment.details.description)
        reasonCell.setValue(descriptionString);

        const ptCell = range.offset(i, 1, 1, 1);
        if (contact.id === unmatchedVetstoriaContactID) {
            handleUnmatchedRecord(appointment, ptCell);
            continue;
        }

        const depositPaidCell = range.offset(i, 2, 1, 1);
        const hasDepositPaidStatus = appointment.details.appointment_status_id === '37';
        if (hasDepositPaidStatus) {
            depositPaidCell.setValue('yes');
        }
        else {
            depositPaidCell.setValue('no').setBackground(highPriorityColor)
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

        const firstTimeHereCell = range.offset(i, 4, 1, 1);
        if (firstTime) {
            firstTimeHereCell.setValue('yes').setBackground(highPriorityColor);
        }
        else if (patientsLastVisitDate) {
            firstTimeHereCell.setValue(`${animal.name}'s last visit: ${patientsLastVisitDate}`);
        }
        else if (otherAnimalsWhoHaveBeenHere) {
            firstTimeHereCell
                .setValue(`first time for ${animal.name} but owner has been in with ${otherAnimalsWhoHaveBeenHere}`)
                .setBackground(highPriorityColor);
        }
        else {
            firstTimeHereCell.setValue('ERROR').setBackground(highPriorityColor);
            console.error(`first time here cell data not found for ${animal.name} ${contact.last_name}`);
        }


        const recordsCell = range.offset(i, 5, 1, 1);
        records.link
            ? recordsCell.setRichTextValue(
                makeLink(records.text, records.link)
            )
            : recordsCell.setValue(records.text);
        if (records.highPriority) {
            recordsCell.setBackground(highPriorityColor);
        }


        const hxFractiousCell = range.offset(i, 6, 1, 1);
        animal.is_hostile === '1'
            ? hxFractiousCell.setValue('yes').setBackground(highPriorityColor)
            : hxFractiousCell.setValue('no');


        const { sedativeName, sedativeDateLastFilled, rxErrorItem } = processPrescriptionItems(prescriptions, prescriptionItems);
        if (rxErrorItem) {
            console.error(`error processing rxs for ${ptText}`);
            console.error(`${ptText} prescriptions: `, prescriptions);
            console.error('rxErrorItem: ', rxErrorItem);
        }
        const hasSedCell = range.offset(i, 7, 1, 1);
        let sedCellVal;
        if (rxErrorItem) {
            sedCellVal = 'ERROR';
        }
        else if (sedativeName === undefined) {
            sedCellVal = 'no'
        }
        else {
            sedCellVal = `${sedativeName} last filled ${convertEpochToUserTimezoneDate(sedativeDateLastFilled)}`;
        }
        hasSedCell.setValue(sedCellVal);
    }
}

function getTimeCellValue(i, startTime, contactID, dtAppts) {
    const isSameFam = i > 0 && contactID === dtAppts[i - 1].contact.id;
    if (isSameFam && contactID !== unmatchedVetstoriaContactID) {
        return '^same fam^';
    }
    const time = convertEpochToUserTimezone(startTime);
    return time;
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
            if (!rxDate) {
                return { rxErrorItem: prescriptionitem }
            }
            if (rxDate > sedativeDateLastFilled) {
                sedativeName = 'gabapentin';
                sedativeDateLastFilled = rxDate;
            }

        }
        else if (trazProductIDSet.has(productID)) {
            const rxDate = getRxDate(prescriptions, prescriptionitem.prescription_id);
            if (!rxDate) {
                return { rxErrorItem: prescriptionitem }
            }
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
    if (!rx) {
        return undefined;
    }
    return Number(rx.prescription.date_of_prescription);
}

function handleUnmatchedRecord(appointment, ptCell) {
    const descriptionString = appointment.details.description;
    const [_, wonkyAnimalData, contactName, emailAndPhone] = descriptionString.split(' - ');
    const [email, phone] = emailAndPhone.split(" ");
    const animalName = wonkyAnimalData.replace(/^\s*\(New client\) ?/, '').trim();
    // remove empty whitespace and (New client) at the front of this string^^^
    ptCell.setValue(`UNMATCHED PATIENT/CLIENT:\n${animalName}\n${contactName}\n${email}\n${phone}`);
    ptCell.setBackground(highPriorityColor);

    let columnDistFromPtCell = 2;
    while (columnDistFromPtCell <= 5) {
        ptCell.offset(0, columnDistFromPtCell++)
            .setValue('-');
    }

    return;
}