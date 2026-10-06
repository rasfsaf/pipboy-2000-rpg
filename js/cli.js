/**
 * Custom CLI (Command Line Interface) Engine for Pip-Boy 2000
 * Handles text commands, parser, history navigation, and terminal output logging.
 */

class PipCliEngine {
  constructor(logContainerId) {
    this.container = document.getElementById(logContainerId);
    this.history = [];
    this.historyIndex = -1;
    this.maxLines = 120;
    this.handlers = {};
  }

  registerCommand(cmdName, callback, description = '') {
    this.handlers[cmdName.toLowerCase()] = { fn: callback, desc: description };
  }

  log(text, cssClass = 'msg-system') {
    if (!this.container) return;
    const line = document.createElement('div');
    line.className = `cli-msg ${cssClass}`;
    line.innerHTML = text;
    this.container.appendChild(line);

    // Limit log lines
    while (this.container.children.length > this.maxLines) {
      this.container.removeChild(this.container.firstChild);
    }

    // Auto-scroll
    this.container.scrollTop = this.container.scrollHeight;
  }

  clear() {
    if (this.container) {
      this.container.innerHTML = '';
      this.log('PIP-OS(R) V2.0 TERMINAL INITIALIZED.', 'msg-system');
    }
  }

  execute(rawCommand) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    // Add to history
    this.history.push(trimmed);
    this.historyIndex = this.history.length;

    // Echo player command
    this.log(`> ${trimmed}`, 'msg-player');
    if (window.pipAudio) window.pipAudio.playBeep(900, 0.04);

    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (this.handlers[cmd]) {
      this.handlers[cmd].fn(args);
    } else {
      this.log(`Command not recognized: "${cmd}". Type "help" or "?" for available commands.`, 'msg-combat');
    }
  }

  getHistoryPrev() {
    if (this.history.length === 0) return '';
    if (this.historyIndex > 0) this.historyIndex--;
    return this.history[this.historyIndex] || '';
  }

  getHistoryNext() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      return this.history[this.historyIndex];
    } else {
      this.historyIndex = this.history.length;
      return '';
    }
  }
}

window.PipCliEngine = PipCliEngine;
