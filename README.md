I develop and maintain a Google Apps Script for [Urban Animal](https://urbananimalnw.com/) which integrates an internal tool with our veterinary EHR, [ezyVet](https://www.ezyvet.com/). I also work the front desk : ) 

The tool is a Google Sheet that we call the "White Board", and it functions as a real-time tracker for the 20-70 onsite pets actively under the care of Urban Animal. The spreadsheet is used across its three Seattle locations by over 100 employees.

The project utilizes Google Cloud Platform, webhooks from ezyVet's fab API, Github Actions and Javascript.

Successfully populating a previously empty room can play a generic notification
on a location-specific YoLink SpeakerHub. Adding another pet to an occupied
multiple-pet room does not play a sound. Apps Script authenticates directly
with the YoLink Cloud API; credentials and location-to-device-name mappings are
kept in Script Properties, and sound delivery is best-effort so it cannot
interrupt whiteboard updates.
