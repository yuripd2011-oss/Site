(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const readStore = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`Não foi possível ler ${key} do armazenamento local.`, error);
      return fallback;
    }
  };
  const saveStore = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Não foi possível salvar ${key} no armazenamento local.`, error);
      showToast("Não foi possível salvar neste navegador.");
      return false;
    }
  };
  let toastTimeout;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2300);
  }
  const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const pageNames = {
    inicio: "Visão geral", calculadora: "Calculadora", tarefas: "Tarefas", financas: "Finanças",
    tempo: "Foco & tempo", notas: "Bloco de notas", conversor: "Conversor"
  };
  function navigate(view) {
    if (!pageNames[view]) view = "inicio";
    $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
    $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === view));
    $("#current-page").textContent = pageNames[view];
    $("#sidebar").classList.remove("open");
    $("#menu-button").setAttribute("aria-expanded", "false");
    if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  }
  $$(".nav-link").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    navigate(link.dataset.view);
  }));
  $$("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
  $("#menu-button").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menu-button").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $("#sidebar").classList.remove("open");
      $("#menu-button").setAttribute("aria-expanded", "false");
    }
  });
  navigate(location.hash.slice(1));

  const tasks = readStore("lifehub-tasks", []);
  function renderTasks() {
    const list = $("#task-list");
    list.replaceChildren();
    tasks.forEach(task => {
      const item = document.createElement("li");
      item.className = `task-item${task.done ? " done" : ""}`;
      const toggle = document.createElement("button");
      toggle.className = "task-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-label", task.done ? "Reabrir tarefa" : "Concluir tarefa");
      toggle.textContent = task.done ? "✓" : "";
      toggle.addEventListener("click", () => {
        task.done = !task.done;
        saveStore("lifehub-tasks", tasks);
        renderTasks();
      });
      const text = document.createElement("span");
      text.className = "task-text";
      text.textContent = task.text;
      const remove = document.createElement("button");
      remove.className = "delete-button";
      remove.type = "button";
      remove.setAttribute("aria-label", `Excluir tarefa: ${task.text}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const index = tasks.indexOf(task);
        tasks.splice(index, 1);
        saveStore("lifehub-tasks", tasks);
        renderTasks();
      });
      item.append(toggle, text, remove);
      list.append(item);
    });
    const pending = tasks.filter(task => !task.done).length;
    $("#task-count").textContent = `${tasks.length} ${tasks.length === 1 ? "tarefa" : "tarefas"} · ${pending} pendente${pending === 1 ? "" : "s"}`;
    $("#task-empty").hidden = tasks.length > 0;
    $("#stat-tasks").textContent = pending;
    const preview = $("#task-preview-list");
    preview.replaceChildren();
    const nextTasks = tasks.slice(0, 4);
    if (nextTasks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "preview-empty";
      empty.textContent = "Nenhuma tarefa pendente. Aproveite o momento.";
      preview.append(empty);
    } else {
      nextTasks.forEach(task => {
        const row = document.createElement("div");
        row.className = `preview-item${task.done ? " done" : ""}`;
        const check = document.createElement("span");
        check.className = "preview-check";
        const label = document.createElement("span");
        label.textContent = task.text;
        row.append(check, label);
        preview.append(row);
      });
    }
  }
  $("#task-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#task-input");
    const text = input.value.trim();
    if (!text) return;
    tasks.unshift({ text, done: false, id: Date.now() });
    saveStore("lifehub-tasks", tasks);
    input.value = "";
    renderTasks();
  });
  $("#clear-completed").addEventListener("click", () => {
    const remaining = tasks.filter(task => !task.done);
    tasks.splice(0, tasks.length, ...remaining);
    saveStore("lifehub-tasks", tasks);
    renderTasks();
  });
  renderTasks();

  const transactions = readStore("lifehub-transactions", []);
  function renderFinance() {
    const income = transactions.filter(item => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = transactions.filter(item => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    $("#finance-balance").textContent = money(income - expenses);
    $("#finance-income").textContent = money(income);
    $("#finance-expenses").textContent = money(expenses);
    $("#stat-balance").textContent = money(income - expenses);
    $("#finance-list").replaceChildren();
    transactions.forEach(item => {
      const row = document.createElement("div");
      row.className = "finance-item";
      const symbol = document.createElement("span");
      symbol.className = `finance-symbol ${item.type}`;
      symbol.textContent = item.type === "income" ? "↙" : "↗";
      const desc = document.createElement("span");
      desc.className = "finance-desc";
      const title = document.createElement("span");
      title.textContent = item.description;
      const date = document.createElement("span");
      date.className = "finance-date";
      date.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.date));
      desc.append(title, date);
      const value = document.createElement("span");
      value.className = `finance-value ${item.type === "income" ? "positive" : "negative"}`;
      value.textContent = `${item.type === "income" ? "+" : "−"} ${money(item.amount)}`;
      const remove = document.createElement("button");
      remove.className = "delete-button";
      remove.type = "button";
      remove.setAttribute("aria-label", `Excluir lançamento: ${item.description}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        const index = transactions.indexOf(item);
        transactions.splice(index, 1);
        saveStore("lifehub-transactions", transactions);
        renderFinance();
      });
      row.append(symbol, desc, value, remove);
      $("#finance-list").append(row);
    });
    $("#finance-empty").hidden = transactions.length > 0;
  }
  $("#finance-form").addEventListener("submit", event => {
    event.preventDefault();
    const description = $("#finance-description").value.trim();
    const amount = Number($("#finance-amount").value);
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      showToast("Informe uma descrição e um valor maior que zero.");
      return;
    }
    transactions.unshift({ description, amount, type: $("#finance-type").value, date: new Date().toISOString() });
    saveStore("lifehub-transactions", transactions);
    $("#finance-form").reset();
    renderFinance();
  });
  renderFinance();

  const notes = $("#notes-area");
  notes.value = readStore("lifehub-notes", "");
  function updateNotesCount() {
    const count = notes.value.length;
    $("#notes-count").textContent = `${count} ${count === 1 ? "caractere" : "caracteres"}`;
  }
  let notesTimeout;
  notes.addEventListener("input", () => {
    updateNotesCount();
    $("#notes-status").textContent = "Salvando...";
    clearTimeout(notesTimeout);
    notesTimeout = setTimeout(() => {
      if (saveStore("lifehub-notes", notes.value)) $("#notes-status").textContent = "Salvo localmente";
    }, 350);
  });
  $("#clear-notes").addEventListener("click", () => {
    if (!notes.value || confirm("Deseja apagar todas as suas anotações?")) {
      notes.value = "";
      saveStore("lifehub-notes", "");
      updateNotesCount();
      $("#notes-status").textContent = "Salvo localmente";
    }
  });
  updateNotesCount();

  const units = {
    length: { "Milímetros (mm)": 0.001, "Centímetros (cm)": 0.01, "Metros (m)": 1, "Quilômetros (km)": 1000, "Polegadas (in)": 0.0254, "Pés (ft)": 0.3048 },
    weight: { "Miligramas (mg)": 0.000001, "Gramas (g)": 0.001, "Quilogramas (kg)": 1, "Toneladas (t)": 1000, "Onças (oz)": 0.028349523125, "Libras (lb)": 0.45359237 },
    temperature: { "Celsius (°C)": "c", "Fahrenheit (°F)": "f", "Kelvin (K)": "k" }
  };
  function convertTemperature(value, from, to) {
    const celsius = from === "c" ? value : from === "f" ? (value - 32) * 5 / 9 : value - 273.15;
    return to === "c" ? celsius : to === "f" ? celsius * 9 / 5 + 32 : celsius + 273.15;
  }
  function updateUnits() {
    const category = $("#conversion-category").value;
    const from = $("#conversion-from");
    const to = $("#conversion-to");
    const options = Object.keys(units[category]);
    const previousFrom = from.value;
    const previousTo = to.value;
    from.replaceChildren(...options.map((name, index) => new Option(name, String(index))));
    to.replaceChildren(...options.map((name, index) => new Option(name, String(index))));
    from.value = options[Number(previousFrom)] ? previousFrom : "0";
    to.value = options[Number(previousTo)] ? previousTo : String(Math.min(1, options.length - 1));
    updateConversion();
  }
  function updateConversion() {
    const category = $("#conversion-category").value;
    const values = Object.values(units[category]);
    const value = Number($("#conversion-value").value);
    if (!Number.isFinite(value)) {
      $("#conversion-result").textContent = "—";
      return;
    }
    const fromUnit = values[Number($("#conversion-from").value)];
    const toUnit = values[Number($("#conversion-to").value)];
    const result = category === "temperature" ? convertTemperature(value, fromUnit, toUnit) : value * fromUnit / toUnit;
    $("#conversion-result").textContent = `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(result)} ${Object.keys(units[category])[Number($("#conversion-to").value)].match(/\((.*?)\)/)[1]}`;
  }
  $("#conversion-category").addEventListener("change", updateUnits);
  $("#conversion-from").addEventListener("change", updateConversion);
  $("#conversion-to").addEventListener("change", updateConversion);
  $("#conversion-value").addEventListener("input", updateConversion);
  updateUnits();

  let calcExpression = "";
  let calcJustEvaluated = false;
  function renderCalc() {
    $("#calc-expression").textContent = calcExpression.replace(/\*/g, " × ").replace(/\//g, " ÷ ").replace(/\+/g, " + ").replace(/-/g, " − ");
    try {
      $("#calc-result").textContent = calcExpression ? formatNumber(evaluateExpression(calcExpression)) : "0";
    } catch {
      $("#calc-result").textContent = " ";
    }
  }
  function formatNumber(value) {
    if (!Number.isFinite(value)) throw new Error("Resultado inválido");
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 8 }).format(value);
  }
  function evaluateExpression(source) {
    const tokens = source.match(/\d*\.?\d+|[()+\-*/%]/g);
    if (!tokens || tokens.join("") !== source.replace(/\s/g, "")) throw new Error("Expressão inválida");
    let index = 0;
    function primary() {
      const token = tokens[index++];
      if (token === "+") return primary();
      if (token === "-") return -primary();
      if (token === "(") {
        const value = expression();
        if (tokens[index++] !== ")") throw new Error("Parênteses inválidos");
        return value;
      }
      if (!token || !/^\d*\.?\d+$/.test(token)) throw new Error("Número inválido");
      return Number(token);
    }
    function term() {
      let value = primary();
      while (["*", "/", "%"].includes(tokens[index])) {
        const operator = tokens[index++];
        const right = primary();
        if ((operator === "/" || operator === "%") && right === 0) throw new Error("Divisão por zero");
        value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
      }
      return value;
    }
    function expression() {
      let value = term();
      while (tokens[index] === "+" || tokens[index] === "-") {
        const operator = tokens[index++];
        const right = term();
        value = operator === "+" ? value + right : value - right;
      }
      return value;
    }
    const result = expression();
    if (index !== tokens.length) throw new Error("Expressão inválida");
    return result;
  }
  function calcInput(action, value) {
    if (action === "clear") { calcExpression = ""; calcJustEvaluated = false; }
    else if (action === "back") { calcExpression = calcExpression.slice(0, -1); calcJustEvaluated = false; }
    else if (action === "digit") {
      if (calcJustEvaluated) calcExpression = "";
      calcExpression += value;
      calcJustEvaluated = false;
    } else if (action === "decimal") {
      if (calcJustEvaluated) calcExpression = "";
      const current = calcExpression.split(/[+\-*/%()]/).pop();
      if (!current.includes(".")) calcExpression += current ? "." : "0.";
      calcJustEvaluated = false;
    } else if (action === "operator") {
      if (!calcExpression && value !== "-") return;
      if (/[+\-*/%]$/.test(calcExpression)) calcExpression = calcExpression.slice(0, -1) + value;
      else calcExpression += value;
      calcJustEvaluated = false;
    } else if (action === "sign") {
      const match = calcExpression.match(/(\d*\.?\d+)$/);
      if (match) {
        const start = match.index;
        calcExpression = calcExpression.slice(0, start) + (calcExpression[start - 1] === "-" ? calcExpression.slice(start + 1) : `-${match[0]}`);
      }
    } else if (action === "equals") {
      try {
        calcExpression = String(evaluateExpression(calcExpression));
        calcJustEvaluated = true;
      } catch {
        showToast("Confira a expressão antes de calcular.");
      }
    }
    renderCalc();
  }
  $$(".calc-key").forEach(button => button.addEventListener("click", () => calcInput(button.dataset.calc, button.dataset.value)));
  document.addEventListener("keydown", event => {
    if ($("#view-calculadora").classList.contains("active") && /^[0-9.+\-*/%]$/.test(event.key)) calcInput(/[0-9]/.test(event.key) ? "digit" : event.key === "." ? "decimal" : "operator", event.key);
    if ($("#view-calculadora").classList.contains("active") && event.key === "Enter") calcInput("equals");
    if ($("#view-calculadora").classList.contains("active") && event.key === "Backspace") calcInput("back");
  });

  const clockUpdate = () => {
    const now = new Date();
    $("#dashboard-clock").textContent = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);
    $("#dashboard-date").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(now);
    $("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" }).format(now);
  };
  clockUpdate();
  setInterval(clockUpdate, 1000);

  let timerDuration = 25 * 60;
  let timerRemaining = timerDuration;
  let timerInterval = null;
  let timerEndAt = null;
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    return `${String(mins).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function updateTimer() {
    $("#timer-display").textContent = formatTime(timerRemaining);
    $("#stat-focus").textContent = formatTime(timerRemaining);
    $("#timer-toggle").textContent = timerInterval ? "Pausar foco" : "Iniciar foco";
  }
  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerEndAt = null;
    updateTimer();
  }
  function runTimer() {
    timerRemaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
    if (timerRemaining <= 0) {
      timerRemaining = 0;
      stopTimer();
      showToast("Sessão concluída. Bom trabalho!");
      if ("Notification" in window && Notification.permission === "granted") new Notification("LIFEHUB", { body: "Sua sessão de foco terminou." });
    } else updateTimer();
  }
  $$(".preset").forEach(button => button.addEventListener("click", () => {
    stopTimer();
    $$(".preset").forEach(preset => preset.classList.toggle("active", preset === button));
    timerDuration = Number(button.dataset.minutes) * 60;
    timerRemaining = timerDuration;
    updateTimer();
  }));
  $("#timer-toggle").addEventListener("click", () => {
    if (timerInterval) stopTimer();
    else {
      timerEndAt = Date.now() + timerRemaining * 1000;
      timerInterval = setInterval(runTimer, 200);
      updateTimer();
    }
  });
  $("#timer-reset").addEventListener("click", () => { stopTimer(); timerRemaining = timerDuration; updateTimer(); });
  updateTimer();

  let stopwatchInterval = null;
  let stopwatchElapsed = 0;
  let stopwatchStarted = 0;
  function updateStopwatch() {
    const total = stopwatchElapsed + (stopwatchInterval ? Date.now() - stopwatchStarted : 0);
    const tenths = Math.floor(total / 100);
    const minutes = Math.floor(tenths / 600);
    const seconds = Math.floor(tenths / 10) % 60;
    $("#stopwatch-display").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
    $("#stopwatch-toggle").textContent = stopwatchInterval ? "Parar" : stopwatchElapsed ? "Continuar" : "Iniciar";
    $("#stopwatch-lap").disabled = !stopwatchInterval;
  }
  $("#stopwatch-toggle").addEventListener("click", () => {
    if (stopwatchInterval) {
      stopwatchElapsed += Date.now() - stopwatchStarted;
      clearInterval(stopwatchInterval);
      stopwatchInterval = null;
    } else {
      stopwatchStarted = Date.now();
      stopwatchInterval = setInterval(updateStopwatch, 100);
    }
    updateStopwatch();
  });
  $("#stopwatch-lap").addEventListener("click", () => {
    if (!stopwatchInterval) return;
    const total = stopwatchElapsed + Date.now() - stopwatchStarted;
    const tenths = Math.floor(total / 100);
    const lap = document.createElement("div");
    lap.textContent = `Volta ${$("#stopwatch-laps").children.length + 1} · ${String(Math.floor(tenths / 600)).padStart(2, "0")}:${String(Math.floor(tenths / 10) % 60).padStart(2, "0")}.${tenths % 10}`;
    $("#stopwatch-laps").prepend(lap);
  });
  $("#stopwatch-reset").addEventListener("click", () => {
    clearInterval(stopwatchInterval);
    stopwatchInterval = null;
    stopwatchElapsed = 0;
    $("#stopwatch-laps").replaceChildren();
    updateStopwatch();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && timerInterval) runTimer();
    if (!document.hidden && stopwatchInterval) updateStopwatch();
  });
  updateStopwatch();
})();
