class TaskReminder {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('reminder_tasks')) || [];
        this.history = JSON.parse(localStorage.getItem('reminder_history')) || [];
        this.activeReminders = new Set();
        this.currentMode = 'interval';
        
        this.initElements();
        this.initEventListeners();
        this.render();
        this.startTimer();
        
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    initElements() {
        this.taskNameInput = document.getElementById('taskName');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.taskList = document.getElementById('taskList');
        this.historyList = document.getElementById('historyList');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        // Mode switchers
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.settingsPanels = {
            interval: document.getElementById('intervalSettings'),
            daily: document.getElementById('dailySettings'),
            weekly: document.getElementById('weeklySettings')
        };

        // Input fields per mode
        this.inputs = {
            interval: document.getElementById('taskInterval'),
            dailyTime: document.getElementById('dailyTime'),
            weeklyTime: document.getElementById('weeklyTime'),
            weekdays: document.querySelectorAll('.weekday-selector input')
        };
        
        this.modal = document.getElementById('reminderModal');
        this.modalTaskName = document.getElementById('reminderTaskName');
        this.markCompleteBtn = document.getElementById('markCompleteBtn');
        this.snoozeBtn = document.getElementById('snoozeBtn');
        
        this.currentReminderTaskId = null;
    }

    initEventListeners() {
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.markCompleteBtn.addEventListener('click', () => this.completeTask(this.currentReminderTaskId));
        this.snoozeBtn.addEventListener('click', () => this.snoozeTask(this.currentReminderTaskId));
        
        // Mode switching logic
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchMode(mode);
            });
        });

        this.taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        this.modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        Object.keys(this.settingsPanels).forEach(m => {
            this.settingsPanels[m].classList.toggle('hidden', m !== mode);
        });
    }

    addTask() {
        const name = this.taskNameInput.value.trim();
        if (!name) {
            alert('請輸入任務名稱');
            return;
        }

        const taskData = {
            id: Date.now(),
            name,
            mode: this.currentMode,
            createdAt: Date.now(),
            lastRun: null
        };

        if (this.currentMode === 'interval') {
            const interval = parseInt(this.inputs.interval.value);
            if (isNaN(interval) || interval < 1) return alert('請輸入有效週期');
            taskData.interval = interval;
        } else if (this.currentMode === 'daily') {
            taskData.time = this.inputs.dailyTime.value;
        } else if (this.currentMode === 'weekly') {
            taskData.time = this.inputs.weeklyTime.value;
            taskData.weekdays = Array.from(this.inputs.weekdays)
                .filter(i => i.checked)
                .map(i => parseInt(i.value));
            
            if (taskData.weekdays.length === 0) return alert('請至少選擇一個星期幾');
        }

        taskData.nextRun = this.calculateNextRun(taskData);

        this.tasks.push(taskData);
        this.saveData();
        this.render();
        
        this.taskNameInput.value = '';
    }

    calculateNextRun(task) {
        const now = new Date();
        
        if (task.mode === 'interval') {
            return Date.now() + (task.interval * 60 * 1000);
        }

        const [hours, minutes] = task.time.split(':').map(Number);
        
        if (task.mode === 'daily') {
            const next = new Date(now);
            next.setHours(hours, minutes, 0, 0);
            if (next <= now) next.setDate(next.getDate() + 1);
            return next.getTime();
        }

        if (task.mode === 'weekly') {
            let minDiff = Infinity;
            let targetDate = null;

            task.weekdays.forEach(day => {
                const next = new Date(now);
                next.setHours(hours, minutes, 0, 0);
                
                let dayDiff = (day - now.getDay() + 7) % 7;
                if (dayDiff === 0 && next <= now) dayDiff = 7;
                
                next.setDate(next.getDate() + dayDiff);
                if (next.getTime() < minDiff) {
                    minDiff = next.getTime();
                    targetDate = next;
                }
            });
            return targetDate.getTime();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveData();
        this.render();
    }

    completeTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            this.history.unshift({
                taskId: task.id,
                name: task.name,
                completedAt: Date.now()
            });
            if (this.history.length > 50) this.history.pop();

            task.lastRun = Date.now();
            task.nextRun = this.calculateNextRun(task);
            
            this.saveData();
            this.render();
        }
        this.closeModal();
    }

    snoozeTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.nextRun = Date.now() + (5 * 60 * 1000);
            this.saveData();
            this.render();
        }
        this.closeModal();
    }

    saveData() {
        localStorage.setItem('reminder_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('reminder_history', JSON.stringify(this.history));
    }

    startTimer() {
        setInterval(() => {
            const now = Date.now();
            this.tasks.forEach(task => {
                if (now >= task.nextRun && !this.activeReminders.has(task.id)) {
                    this.triggerReminder(task);
                }
            });
            this.updateUI();
        }, 1000);
    }

    triggerReminder(task) {
        if (this.activeReminders.has(task.id)) return;
        this.activeReminders.add(task.id);
        this.currentReminderTaskId = task.id;
        this.modalTaskName.textContent = task.name;
        this.modal.classList.remove('hidden');

        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("任務提醒", { body: `是時候進行：${task.name}` });
        }
    }

    closeModal() {
        if (this.currentReminderTaskId) this.activeReminders.delete(this.currentReminderTaskId);
        this.modal.classList.add('hidden');
        this.currentReminderTaskId = null;
    }

    updateUI() {
        this.tasks.forEach(task => {
            const el = document.getElementById(`countdown-${task.id}`);
            const progressEl = document.getElementById(`progress-${task.id}`);
            if (el) {
                const diff = Math.max(0, task.nextRun - Date.now());
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                
                let timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                if (hours > 0) timeStr = `${hours}:${timeStr}`;
                el.textContent = timeStr;
                
                if (progressEl && task.mode === 'interval') {
                    const total = task.interval * 60 * 1000;
                    const elapsed = total - diff;
                    progressEl.style.width = `${Math.min(100, (elapsed / total) * 100)}%`;
                } else if (progressEl) {
                    progressEl.style.width = '0%';
                }
            }
        });
    }

    render() {
        this.renderTasks();
        this.renderHistory();
    }

    getScheduleDesc(task) {
        if (task.mode === 'interval') return `每 ${task.interval} 分鐘`;
        if (task.mode === 'daily') return `每天 ${task.time}`;
        if (task.mode === 'weekly') {
            const daysMap = ['日', '一', '二', '三', '四', '五', '六'];
            const days = task.weekdays.map(d => daysMap[d]);
            return `每週 (${days.join(',')}) ${task.time}`;
        }
    }

    renderTasks() {
        if (this.tasks.length === 0) {
            this.taskList.innerHTML = '<div class="empty-state"><p>目前沒有任務</p></div>';
            return;
        }

        this.taskList.innerHTML = this.tasks.map(task => `
            <div class="task-card">
                <div class="task-header">
                    <h3>${task.name}</h3>
                    <button class="delete-task" onclick="app.deleteTask(${task.id})">✖</button>
                </div>
                <div class="task-meta">
                    <span>模式: ${this.getScheduleDesc(task)}</span>
                    <div id="countdown-${task.id}" class="countdown">--:--</div>
                </div>
                <div id="progress-${task.id}" class="progress-bar"></div>
            </div>
        `).join('');
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">尚無紀錄</p>';
            return;
        }
        this.historyList.innerHTML = this.history.map(entry => {
            const date = new Date(entry.completedAt);
            return `
                <div class="history-item">
                    <span>${entry.name}</span>
                    <span class="history-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
        }).join('');
    }
}

const app = new TaskReminder();
window.app = app;
