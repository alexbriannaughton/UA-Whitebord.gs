const WHITEBOARD_ROOM_EVENT_SECRET_HEADER = 'x-whiteboard-room-event-secret';

function sendRoomPopulatedEvent(appointment, uaLocSheetName) {
  try {
    const props = PropertiesService.getScriptProperties();
    const url = props.getProperty('whiteboard_room_event_url');
    const secret = props.getProperty('whiteboard_room_event_secret');

    if (!url || !secret) return;

    const payload = {
      eventKey: buildRoomPopulatedEventKey(appointment, uaLocSheetName),
      uaLoc: uaLocSheetName,
      roomStatusId: appointment.status_id,
      roomLabel: getRoomEventLabel(appointment.status_id)
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      headers: {
        [WHITEBOARD_ROOM_EVENT_SECRET_HEADER]: secret
      }
    });

    const responseCode = response.getResponseCode();
    if (responseCode < 200 || responseCode >= 300) {
      console.error(`room populated event failed: ${responseCode}`);
    }
  }
  catch (error) {
    console.error(`room populated event error: ${error.message}`);
  }
}

function buildRoomPopulatedEventKey(appointment, uaLocSheetName) {
  const rawKey = [
    uaLocSheetName,
    appointment.status_id,
    appointment.id,
    appointment.consult_id,
    appointment.modified_at
  ].join('|');

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    rawKey
  );

  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function getRoomEventLabel(statusID) {
  const labels = {
    18: 'Room 1',
    25: 'Room 2',
    26: 'Room 3',
    27: 'Room 4',
    28: 'Room 5',
    21: 'Lobby',
    29: 'Room 6',
    30: 'Room 7',
    31: 'Room 8',
    32: 'Room 9',
    33: 'Room 10',
    36: 'Room 11',
    39: 'Dog Lobby',
    40: 'Cat Lobby',
    41: 'Surgery Room 3',
    42: 'Surgery Room 2',
    43: 'Surgery Room 1',
    44: 'Surgery Lobby'
  };

  return labels[statusID] || `Status ${statusID}`;
}
