let dialogueState = {
  count: 0,
  history: [],
  technique: '',
  scenario: '',
  recordings: []
};

let currentDialogueRecordings = [];

function resetDialogueState(technique) {
  dialogueState = {
    count: 0,
    history: [],
    technique,
    scenario: '',
    recordings: []
  };
  currentDialogueRecordings = [];
}

function updateDialogueState(updates) {
  dialogueState = {
    ...dialogueState,
    ...updates
  };
}

function addRecording(recording) {
  const existingRecording = currentDialogueRecordings.find(r => r.path === recording.path);
  if (!existingRecording) {
    currentDialogueRecordings.push(recording);
    console.log('新錄音已添加到對話狀態:', recording);
  } else {
    console.warn('錄音已存在，未重複添加:', recording.path);
  }
}




function getDialogueState() {
  return dialogueState;
}

function getCurrentRecordings() {
  return currentDialogueRecordings;
}

function resetCurrentRecordings() {
  currentDialogueRecordings = [];
}

function addToHistory(entry) {
  dialogueState.history.push(entry);
}

function incrementCount() {
  dialogueState.count++;
}

module.exports = {
  resetDialogueState,
  updateDialogueState,
  addRecording,
  addToHistory,
  incrementCount,
  getDialogueState,
  getCurrentRecordings,
  resetCurrentRecordings
};