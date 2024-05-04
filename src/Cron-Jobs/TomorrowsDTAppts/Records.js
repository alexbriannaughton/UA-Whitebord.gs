// Records.js
async function processRecords(animalAttachmentData, consultAttachmentData, dtAppts, ezyVetFolder) {
    console.log('processing all records...')
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
        let attachmentDownloadResponses = [];
        const downloadIDSet = new Set();
        for (const { attachment } of [...animalAttachments, ...consultAttachments]) {
            const { name, file_download_url } = attachment;

            const downloadID = file_download_url.split('/').at(-1);
            if (downloadIDSet.has(downloadID)) {
                // sometimes certain attachments will show up as both an animal attachment and a consult attachment.
                // we dont want to process them twice
                continue;
            }
            downloadIDSet.add(downloadID);

            fileNameArray.push(name);
            let dlResp;
            try {
                dlResp = UrlFetchApp.fetch(file_download_url, {
                    muteHttpExceptions: true,
                    method: "GET",
                    headers: {
                        authorization: token
                    }
                });

            }
            catch (error) {
                console.error('error at attachment download fetches: ', error);
                console.error('attachment name: ', name);
                console.error(`error^^ after trying to dl attachment for ${animalName}`);
                dlResp = undefined;
            }

            attachmentDownloadResponses.push(dlResp);
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
            text: `${downloadIDSet.size} attachments`
        };
    }
}

async function buildPDF(attachmentDownloadResponses, fileNameArray, mergedPDF, animalName) {
    console.log(`building pdf for ${animalName}...`);

    for (let j = 0; j < attachmentDownloadResponses.length; j++) {
        const fileNameInEzyVet = fileNameArray[j];
        console.log(`processing ${fileNameInEzyVet}...`);
        const response = attachmentDownloadResponses[j];
        let blob;
        try {
            blob = response.getBlob();
        }
        catch (error) {
            console.error(`error getting blob for ${fileNameInEzyVet}:`, error);
            handleDownloadError(mergedPDF, fileNameInEzyVet);
            continue;
        }
        const contentType = blob.getContentType();

        console.log(`${fileNameInEzyVet} file type: ${contentType}`);

        const blobByes = new Uint8Array(blob.getBytes());

        if (contentType === 'application/pdf') {
            let pdfData;
            try {
                pdfData = await PDFLib.PDFDocument.load(blobByes);
            }
            catch (error) {
                console.error(`error loading ${fileNameInEzyVet} with PDFLib: `, error);
                handleDownloadError(mergedPDF, fileNameInEzyVet);
                continue;
            }
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

        // attachments should not be coming as json
        else if (contentType === 'application/json') {
            const jsonData = JSON.parse(response.getContentText());
            console.error(`JSON data received for ${fileNameInEzyVet}:`, jsonData);
            handleDownloadError(mergedPDF, fileNameInEzyVet);
            continue; // just so we can avoid hitting the next console log
        }

        console.log(`successfully processed ${fileNameInEzyVet}!`);
    }

    console.log(`saving .pdf for ${animalName}...`);
    const bytes = await mergedPDF.save();
    console.log(`saved pdf for ${animalName}!`)
    return bytes;
}

function handleDownloadError(mergedPDF, fileNameInEzyVet) {
    const page = mergedPDF.addPage();
    const fontSize = 16;
    page.setFontSize(fontSize);
    const textY = page.getHeight() - 50;
    page.drawText(
        `Error downloading the attachment called "${fileNameInEzyVet}"`,
        { y: textY }
    );
}

function driveFolderProcessing(targetDateStr) {
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

    console.log(`creating new drive folder for ${targetDateStr}...`);
    const ezyVetFolder = DriveApp.createFolder(folderNamePrefix + targetDateStr);
    ezyVetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return ezyVetFolder;
}