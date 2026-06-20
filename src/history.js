// ========================================
// MindSchem - Undo/Redo History Manager
// ========================================

export class History {
  constructor(maxSize = 100) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
    this.batching = false;
    this.batchActions = [];
  }

  /**
   * Push an action onto the undo stack.
   * @param {Object} action - { type, undo: Function, redo: Function, description }
   */
  push(action) {
    if (this.batching) {
      this.batchActions.push(action);
      return;
    }

    this.undoStack.push(action);
    this.redoStack = [];

    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  /**
   * Begin batching multiple actions as one undo step.
   */
  beginBatch(description = 'Batch') {
    this.batching = true;
    this.batchActions = [];
    this.batchDescription = description;
  }

  /**
   * End batching and push as single action.
   */
  endBatch() {
    this.batching = false;
    if (this.batchActions.length === 0) return;

    const actions = [...this.batchActions];
    this.batchActions = [];

    this.push({
      type: 'batch',
      description: this.batchDescription,
      undo: () => {
        for (let i = actions.length - 1; i >= 0; i--) {
          actions[i].undo();
        }
      },
      redo: () => {
        for (const action of actions) {
          action.redo();
        }
      }
    });
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();
    action.undo();
    this.redoStack.push(action);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop();
    action.redo();
    this.undoStack.push(action);
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
