// 每筆練習各自保存對話狀態，避免不同使用者同時練習時互相覆蓋。
// practiceId 是 MongoDB 全域唯一值，再搭配 userId 驗證狀態擁有者。
const dialogueStates = new Map();

function getStateKey(practiceId) {
  if (!practiceId) {
    throw new Error('練習 ID 缺失');
  }
  return String(practiceId);
}

function createInitialState(userId, practiceId, technique) {
  return {
    userId: String(userId),
    practiceId: String(practiceId),
    count: 0,
    history: [],
    technique,
    scenario: '',
    recordings: []
  };
}

function resetDialogueState(userId, practiceId, technique) {
  if (!userId) {
    throw new Error('使用者 ID 缺失');
  }

  const key = getStateKey(practiceId);
  const state = createInitialState(userId, practiceId, technique);
  dialogueStates.set(key, state);
  return state;
}

function getDialogueState(userId, practiceId) {
  const key = getStateKey(practiceId);
  const state = dialogueStates.get(key);

  if (!state) return null;
  if (String(state.userId) !== String(userId)) return null;
  return state;
}

function requireDialogueState(userId, practiceId) {
  const state = getDialogueState(userId, practiceId);
  if (!state) {
    throw new Error('對話狀態丟失或無權存取');
  }
  return state;
}

function updateDialogueState(userId, practiceId, updates) {
  const key = getStateKey(practiceId);
  const state = requireDialogueState(userId, practiceId);
  const updatedState = {
    ...state,
    ...updates,
    userId: state.userId,
    practiceId: state.practiceId
  };
  dialogueStates.set(key, updatedState);
  return updatedState;
}

function addRecording(userId, practiceId, recording) {
  const state = requireDialogueState(userId, practiceId);
  const existingRecording = state.recordings.find(r => r.path === recording.path);

  if (!existingRecording) {
    state.recordings.push(recording);
    console.log('新錄音已添加到對話狀態:', recording);
  } else {
    console.warn('錄音已存在，未重複添加:', recording.path);
  }
}

function getCurrentRecordings(userId, practiceId) {
  return requireDialogueState(userId, practiceId).recordings;
}

function resetCurrentRecordings(userId, practiceId) {
  requireDialogueState(userId, practiceId).recordings = [];
}

function addToHistory(userId, practiceId, entry) {
  requireDialogueState(userId, practiceId).history.push(entry);
}

function incrementCount(userId, practiceId) {
  requireDialogueState(userId, practiceId).count++;
}

function deleteDialogueState(userId, practiceId) {
  const state = getDialogueState(userId, practiceId);
  if (!state) return false;
  return dialogueStates.delete(getStateKey(practiceId));
}

module.exports = {
  resetDialogueState,
  updateDialogueState,
  addRecording,
  addToHistory,
  incrementCount,
  getDialogueState,
  getCurrentRecordings,
  resetCurrentRecordings,
  deleteDialogueState
};
