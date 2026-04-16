class TaskReminder {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('reminder_tasks')) || [];
        this.history = JSON.parse(localStorage.getItem('reminder_history')) || [];
        this.points = parseInt(localStorage.getItem('reminder_points')) || 0;
        this.activeReminders = new Set();
        this.currentMode = 'interval';
        
        this.initElements();
        this.initEventListeners();
        this.initChart();
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
        this.totalPointsEl = document.getElementById('totalPoints');
        
        // Mode switchers
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.settingsPanels = {
            interval: document.getElementById('intervalSettings'),
            daily: document.getElementById('dailySettings'),
            weekly: document.getElementById('weeklySettings')
        };

        // Advanced Settings
        this.hasFollowupInput = document.getElementById('hasFollowup');
        this.followupDetail = document.getElementById('followupDetail');
        this.followupDelayInput = document.getElementById('followupDelay');
        this.followupQuestionInput = document.getElementById('followupQuestion');

        // Input fields per mode
        this.inputs = {
            interval: document.getElementById('taskInterval'),
            dailyTime: document.getElementById('dailyTime'),
            weeklyTime: document.getElementById('weeklyTime'),
            weekdays: document.querySelectorAll('.weekday-selector input')
        };
        
        // Modal
        this.modal = document.getElementById('reminderModal');
        this.modalTaskName = document.getElementById('reminderTaskName');
        this.modalMessage = document.getElementById('reminderMessage');
        this.surveySection = document.getElementById('surveySection');
        this.surveyLabel = document.getElementById('surveyLabel');
        this.surveyAnswerInput = document.getElementById('surveyAnswer');
        this.markCompleteBtn = document.getElementById('markCompleteBtn');
        this.surveySubmitBtn = document.getElementById('surveySubmitBtn');
        this.snoozeBtn = document.getElementById('snoozeBtn');
        
        this.currentReminderTask = null;
    }

    initEventListeners() {
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.markCompleteBtn.addEventListener('click', () => this.completeTask());
        this.surveySubmitBtn.addEventListener('click', () => this.submitSurvey());
        this.snoozeBtn.addEventListener('click', () => this.snoozeTask());
        
        this.hasFollowupInput.addEventListener('change', () => {
            this.followupDetail.classList.toggle('hidden', !this.hasFollowupInput.checked);
        });

        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
        });

        this.taskNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
    }

    initChart() {
        const ctx = document.getElementById('statsChart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.getLast7DaysLabels(),
                datasets: [{
                    label: '每日完成數',
                    data: this.getStatsData(),
                    borderColor: '#2dd4bf',
                    backgroundColor: 'rgba(45, 212, 191, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    getLast7DaysLabels() {
        return [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        });
    }

    getStatsData() {
        const dailyCounts = Array(7).fill(0);
        const now = new Date();
        this.history.forEach(item => {
            const date = new Date(item.completedAt);
            const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
            if (diff >= 0 && diff < 7) dailyCounts[6 - diff]++;
        });
        return dailyCounts;
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
        if (!name) return alert('請輸入任務名稱');

        const taskData = {
            id: Date.now(),
            name,
            mode: this.currentMode,
            createdAt: Date.now(),
            lastRun: null,
            status: 'active',
            hasFollowup: this.hasFollowupInput.checked,
            followupDelay: parseInt(this.followupDelayInput.value) || 0,
            followupQuestion: this.followupQuestionInput.value || '工作成效如何？'
        };

        if (this.currentMode === 'interval') {
            const val = parseInt(this.inputs.interval.value);
            if (isNaN(val) || val < 1) return alert('請輸入週期');
            taskData.interval = val;
        } else if (this.currentMode === 'daily') {
            taskData.time = this.inputs.dailyTime.value;
        } else if (this.currentMode === 'weekly') {
            taskData.time = this.inputs.weeklyTime.value;
            taskData.weekdays = Array.from(this.inputs.weekdays).filter(i => i.checked).map(i => parseInt(i.value));
            if (taskData.weekdays.length === 0) return alert('請選擇週幾');
        }

        taskData.nextRun = this.calculateNextRun(taskData);
        this.tasks.push(taskData);
        this.saveData();
        this.render();
        this.taskNameInput.value = '';
    }

    calculateNextRun(task) {
        const now = new Date();
        if (task.status === 'survey-pending') return task.surveyTime;
        if (task.mode === 'interval') return Date.now() + (task.interval * 60 * 1000);
        const [h, m] = task.time.split(':').map(Number);
        const next = new Date(now);
        next.setHours(h, m, 0, 0);
        if (task.mode === 'daily') {
            if (next <= now) next.setDate(next.getDate() + 1);
            return next.getTime();
        }
        if (task.mode === 'weekly') {
            let minDiff = Infinity;
            let target = null;
            task.weekdays.forEach(day => {
                const d = new Date(next);
                let diff = (day - now.getDay() + 7) % 7;
                if (diff === 0 && d <= now) diff = 7;
                d.setDate(d.getDate() + diff);
                if (d.getTime() < minDiff) { minDiff = d.getTime(); target = d; }
            });
            return target.getTime();
        }
    }

    completeTask() {
        const task = this.currentReminderTask;
        if (!task) return;

        this.addHistory(task.name, 10);
        this.fireConfetti();
        
        if (task.hasFollowup) {
            task.status = 'survey-pending';
            task.surveyTime = Date.now() + (task.followupDelay * 60 * 1000);
            task.nextRun = task.surveyTime;
        } else {
            task.lastRun = Date.now();
            task.nextRun = this.calculateNextRun(task);
        }

        this.saveData();
        this.render();
        this.closeModal();
    }

    submitSurvey() {
        const task = this.currentReminderTask;
        const answer = this.surveyAnswerInput.value.trim();
        if (!answer) return alert('請填寫問卷內容');

        this.addHistory(`${task.name} 問卷: ${answer}`, 15);
        this.fireConfetti();

        task.status = 'active';
        task.lastRun = Date.now();
        task.nextRun = this.calculateNextRun(task);

        this.saveData();
        this.render();
        this.closeModal();
    }

    addHistory(name, pts) {
        this.history.unshift({ name, completedAt: Date.now() });
        this.points += pts;
        this.chart.data.datasets[0].data = this.getStatsData();
        this.chart.update();
    }

    fireConfetti() {
        const duration = 3 * 1000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#6366f1', '#2dd4bf'] });
            confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#6366f1', '#2dd4bf'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }

    snoozeTask() {
        const task = this.currentReminderTask;
        task.nextRun = Date.now() + (5 * 60 * 1000);
        this.saveData();
        this.render();
        this.closeModal();
    }

    saveData() {
        localStorage.setItem('reminder_tasks', JSON.stringify(this.tasks));
        localStorage.setItem('reminder_history', JSON.stringify(this.history));
        localStorage.setItem('reminder_points', this.points.toString());
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
        this.activeReminders.add(task.id);
        this.currentReminderTask = task;
        this.modalTaskName.textContent = task.name;
        
        if (task.status === 'survey-pending') {
            this.modalMessage.textContent = '任務後續問卷提醒：';
            this.surveySection.classList.remove('hidden');
            this.surveyLabel.textContent = task.followupQuestion;
            this.markCompleteBtn.classList.add('hidden');
            this.surveySubmitBtn.classList.remove('hidden');
            this.surveyAnswerInput.value = '';
        } else {
            this.modalMessage.textContent = '是時候進行這項工作了。完成後請點擊下方按鈕進行記錄。';
            this.surveySection.classList.add('hidden');
            this.markCompleteBtn.classList.remove('hidden');
            this.surveySubmitBtn.classList.add('hidden');
        }

        this.modal.classList.remove('hidden');
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(task.status === 'survey-pending' ? "問卷提醒" : "任務提醒", { body: task.name });
        }
    }

    closeModal() {
        if (this.currentReminderTask) this.activeReminders.delete(this.currentReminderTask.id);
        this.modal.classList.add('hidden');
        this.currentReminderTask = null;
    }

    updateUI() {
        this.totalPointsEl.textContent = this.points;
        this.tasks.forEach(task => {
            const el = document.getElementById(`countdown-${task.id}`);
            if (el) {
                const diff = Math.max(0, task.nextRun - Date.now());
                const hours = Math.floor(diff / 3600000);
                const minutes = Math.floor((diff % 3600000) / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                el.textContent = `${hours > 0 ? hours + ':' : ''}${minutes}:${seconds.toString().padStart(2, '0')}`;
                if (task.status === 'survey-pending') el.style.color = '#c084fc';
                else el.style.color = 'var(--accent-3)';
            }
        });
    }

    render() {
        this.renderTasks();
        this.renderHistory();
    }

    renderTasks() {
        if (this.tasks.length === 0) {
            this.taskList.innerHTML = '<div class="empty-state"><p>目前沒有任務</p></div>';
            return;
        }
        this.taskList.innerHTML = this.tasks.map(task => `
            <div class="task-card ${task.status === 'survey-pending' ? 'survey-mode' : ''}">
                <div class="task-header">
                    <h3>${task.name}</h3>
                    <button class="delete-task" onclick="app.deleteTask(${task.id})">✖</button>
                </div>
                <div class="task-meta">
                    <span>${task.status === 'survey-pending' ? '🔔 待填問卷' : '⏳ 模式: ' + this.getScheduleDesc(task)}</span>
                    <div id="countdown-${task.id}" class="countdown">--:--</div>
                </div>
                <div id="progress-${task.id}" class="progress-bar"></div>
            </div>
        `).join('');
    }

    getScheduleDesc(t) {
        if (t.mode === 'interval') return `每 ${t.interval} 分鐘`;
        if (t.mode === 'daily') return `每天 ${t.time}`;
        const daysMap = ['日', '一', '二', '三', '四', '五', '六'];
        return `每週 (${t.weekdays.map(d => daysMap[d]).join(',')}) ${t.time}`;
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveData();
        this.render();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 1rem;">尚無紀錄</p>';
            return;
        }
        this.historyList.innerHTML = this.history.map(entry => {
            const date = new Date(entry.completedAt);
            return `<div class="history-item"><span>${entry.name}</span><span class="history-time">${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`;
        }).join('');
    }

    clearHistory() { if (confirm('確定清除清單？')) { this.history = []; this.points = 0; this.saveData(); this.render(); this.chart.update(); } }
}

const app = new TaskReminder();
window.app = app;
