/**
 * 週期任務提醒工具 Logic
 */

class TaskReminder {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('reminder_tasks')) || [];
        this.history = JSON.parse(localStorage.getItem('reminder_history')) || [];
        this.activeReminders = new Set();
        
        this.initElements();
        this.initEventListeners();
        this.render();
        this.startTimer();
        
        // Request notification permission
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    initElements() {
        this.taskNameInput = document.getElementById('taskName');
        this.taskIntervalInput = document.getElementById('taskInterval');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.taskList = document.getElementById('taskList');
        this.historyList = document.getElementById('historyList');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        
        // Modal elements
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
        
        // Keypress enter for input
        this.taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
    }

    addTask() {
        const name = this.taskNameInput.value.trim();
        const interval = parseInt(this.taskIntervalInput.value);

        if (!name) {
            alert('請輸入任務名稱');
            return;
        }

        if (isNaN(interval) || interval < 1) {
            alert('請輸入有效的週期 (至少1分鐘)');
            return;
        }

        const newTask = {
            id: Date.now(),
            name,
            interval, // in minutes
            lastRun: Date.now(),
            nextRun: Date.now() + (interval * 60 * 1000),
            createdAt: Date.now()
        };

        this.tasks.push(newTask);
        this.saveData();
        this.render();
        
        this.taskNameInput.value = '';
        this.taskNameInput.focus();
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveData();
        this.render();
    }

    completeTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            // Record to history
            const entry = {
                taskId: task.id,
                name: task.name,
                completedAt: Date.now()
            };
            this.history.unshift(entry);
            
            // Limit history to last 50 entries
            if (this.history.length > 50) this.history.pop();

            // Reset task timer
            task.lastRun = Date.now();
            task.nextRun = Date.now() + (task.interval * 60 * 1000);
            
            this.saveData();
            this.render();
        }
        this.closeModal();
    }

    snoozeTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            // Add 5 minutes
            task.nextRun = Date.now() + (5 * 60 * 1000);
            this.saveData();
            this.render();
        }
        this.closeModal();
    }

    clearHistory() {
        if (confirm('確定要清除所有紀錄嗎？')) {
            this.history = [];
            this.saveData();
            this.render();
        }
    }

    saveData() {
        localStorage.setItem('reminder_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('reminder_history', JSON.stringify(this.history));
    }

    startTimer() {
        setInterval(() => {
            const now = Date.now();
            let changed = false;

            this.tasks.forEach(task => {
                if (now >= task.nextRun && !this.activeReminders.has(task.id)) {
                    this.triggerReminder(task);
                }
            });

            this.updateCountdowns();
        }, 1000);
    }

    triggerReminder(task) {
        this.activeReminders.add(task.id);
        this.currentReminderTaskId = task.id;
        
        // Show modal
        this.modalTaskName.textContent = task.name;
        this.modal.classList.remove('hidden');

        // Play sound (optional, modern browsers might block without user interaction)
        // new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3').play().catch(()=>{});

        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification("任務提醒", {
                body: `是時候進行：${task.name}`,
                icon: "https://cdn-icons-png.flaticon.com/512/1827/1827347.png"
            });
        }
    }

    closeModal() {
        if (this.currentReminderTaskId) {
            this.activeReminders.delete(this.currentReminderTaskId);
        }
        this.modal.classList.add('hidden');
        this.currentReminderTaskId = null;
    }

    updateCountdowns() {
        this.tasks.forEach(task => {
            const el = document.getElementById(`countdown-${task.id}`);
            const progressEl = document.getElementById(`progress-${task.id}`);
            if (el) {
                const diff = Math.max(0, task.nextRun - Date.now());
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                el.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                if (progressEl) {
                    const total = task.interval * 60 * 1000;
                    const elapsed = total - diff;
                    const percent = Math.min(100, (elapsed / total) * 100);
                    progressEl.style.width = `${percent}%`;
                }
            }
        });
    }

    render() {
        this.renderTasks();
        this.renderHistory();
    }

    renderTasks() {
        if (this.tasks.length === 0) {
            this.taskList.innerHTML = `
                <div class="empty-state">
                    <p>目前沒有設定中的任務，快來新增一個吧！</p>
                </div>
            `;
            return;
        }

        this.taskList.innerHTML = this.tasks.map(task => `
            <div class="task-card">
                <div class="task-header">
                    <h3>${task.name}</h3>
                    <button class="delete-task" onclick="app.deleteTask(${task.id})">✖</button>
                </div>
                <div class="task-meta">
                    <span>週期: ${task.interval} 分鐘</span>
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
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            
            return `
                <div class="history-item">
                    <span>${entry.name}</span>
                    <span class="history-time">${dateStr} ${timeStr}</span>
                </div>
            `;
        }).join('');
    }
}

// Global instance for onclick handlers
const app = new TaskReminder();
window.app = app;
