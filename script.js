(() => {
  "use strict";
  const STORAGE_KEY = "verdeFinanceiro.v1";
  const $ = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
  const shortMoney = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(value) || 0);
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const monthISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
  const dateBR = (iso) => { if (!iso) return "Sem data"; const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const safeText = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const categories = {
    income: ["Salário","Freelance","Vendas","Investimentos","Reembolso","Outras entradas"],
    expense: ["Moradia","Alimentação","Transporte","Saúde","Educação","Lazer","Compras","Assinaturas","Contas","Cartão","Pets","Outros"]
  };
  const categoryColors = ["#83e59b","#67c984","#a6e6b4","#e5c779","#86b9e9","#c2a0ef","#f39d9d","#e7a86f","#72d8d2","#b6c2ca","#b9d78c","#dba8cf"];
  const defaultState = () => ({transactions:[],goals:[],bills:[],debts:[]});
  let state = loadState();
  let flowChart = null, categoryChart = null, toastTimer = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && typeof parsed === "object") return {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        goals: Array.isArray(parsed.goals) ? parsed.goals : [],
        bills: Array.isArray(parsed.bills) ? parsed.bills : [],
        debts: Array.isArray(parsed.debts) ? parsed.debts : []
      };
    } catch (error) { console.warn("Não foi possível ler os dados salvos.", error); }
    return defaultState();
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showToast("Não foi possível salvar. Exporte um backup e libere espaço no navegador."); }
  }
  function showToast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  function openDialog(id) { const d = $(id); if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open",""); }
  function closeDialog(id) { const d = $(id); if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); }
  function num(id) { return Number($(id).value); }
  function error(id, message = "") { $(id).textContent = message; }
  function validPositive(value) { return Number.isFinite(value) && value > 0 && value <= 999999999; }
  function validNonNegative(value) { return Number.isFinite(value) && value >= 0 && value <= 999999999; }
  function selectedMonth() { return $("monthFilter").value || monthISO(); }
  function txForMonth(month) { return state.transactions.filter(t => t.date && t.date.slice(0,7) === month); }
  function sum(list, fn) { return list.reduce((total, item) => total + fn(item), 0); }
  function txTypeLabel(type) { return type === "income" ? "Entrada" : "Saída"; }
  function iconFor(t) { return t.type === "income" ? "↙" : "↗"; }

  function render() {
    renderLabels(); renderStats(); renderTransactions(); renderGoals(); renderBills(); renderDebts(); renderCharts();
    $("billCount").textContent = state.bills.filter(b => !b.paid).length;
  }
  function renderLabels() {
    const month = selectedMonth() + "-02";
    const d = new Date(month + "T12:00:00");
    $("monthName").textContent = d.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
    $("todayLabel").textContent = "SEU DINHEIRO, SOB SEU CONTROLE";
  }
  function renderStats() {
    const monthTx = txForMonth(selectedMonth());
    const income = sum(monthTx.filter(t=>t.type==="income"),t=>t.amount);
    const expenses = sum(monthTx.filter(t=>t.type==="expense"),t=>t.amount);
    const allBalance = sum(state.transactions.filter(t=>t.type==="income"),t=>t.amount) - sum(state.transactions.filter(t=>t.type==="expense"),t=>t.amount);
    const openBills = state.bills.filter(b=>!b.paid);
    $("balanceValue").textContent = money(allBalance);
    $("incomeValue").textContent = money(income);
    $("expenseValue").textContent = money(expenses);
    $("openBillsValue").textContent = money(sum(openBills,b=>b.amount));
    $("incomeCount").textContent = `${monthTx.filter(t=>t.type==="income").length} registro(s)`;
    $("expenseCount").textContent = `${monthTx.filter(t=>t.type==="expense").length} registro(s)`;
    $("openBillsCaption").textContent = `${openBills.length} conta(s) pendente(s)`;
  }
  function renderTransactions() {
    const monthTx = txForMonth(selectedMonth()).sort((a,b)=>b.date.localeCompare(a.date));
    const list = monthTx.slice(0,8);
    $("transactionsBody").innerHTML = list.map(t => `<tr>
      <td><div class="transaction-name"><span class="tx-avatar">${iconFor(t)}</span><span>${safeText(t.description)}</span></div></td>
      <td><span class="category-pill">${safeText(t.category)}</span></td><td>${dateBR(t.date)}</td>
      <td class="${t.type==="income"?"amount-income":"amount-expense"}">${t.type==="income"?"+":"−"} ${money(t.amount)}</td>
      <td><div class="row-actions"><button class="mini-action" data-edit-tx="${safeText(t.id)}" aria-label="Editar ${safeText(t.description)}">Editar</button><button class="mini-action" data-delete-tx="${safeText(t.id)}" aria-label="Excluir ${safeText(t.description)}">×</button></div></td>
    </tr>`).join("");
    $("transactionsEmpty").style.display = list.length ? "none" : "block";
  }
  function renderGoals() {
    const goals = state.goals;
    $("goalsList").innerHTML = goals.map(g => {
      const pct = Math.min(100, Math.round(g.saved / g.target * 100));
      return `<div class="goal-item"><div class="goal-head"><span class="goal-name">${safeText(g.name)}</span><span class="goal-amount">${money(g.saved)} / ${money(g.target)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><div class="goal-meta"><span>${g.due ? "Prazo: "+dateBR(g.due) : "Continue no seu ritmo"}</span><strong>${pct}%</strong></div><div class="row-actions" style="margin-top:9px"><button class="mini-action" data-edit-goal="${safeText(g.id)}">Editar</button><button class="mini-action" data-add-saving="${safeText(g.id)}">＋ Guardar</button><button class="mini-action" data-delete-goal="${safeText(g.id)}">Excluir</button></div></div>`;
    }).join("");
    $("goalsEmpty").style.display = goals.length ? "none" : "block";
  }
  function billStatus(b) {
    if (b.paid) return ["Pago","status-paid"];
    if (b.due < todayISO()) return ["Atrasada","status-overdue"];
    if (b.due === todayISO()) return ["Vence hoje","status-due"];
    return ["Pendente","status-due"];
  }
  function renderBills() {
    const bills = [...state.bills].sort((a,b)=>Number(a.paid)-Number(b.paid) || a.due.localeCompare(b.due));
    $("billsList").innerHTML = bills.map(b => {
      const [label, cls] = billStatus(b);
      return `<div class="list-item"><div class="list-icon">▤</div><div class="list-main"><strong>${safeText(b.name)}</strong><small>${safeText(b.category)} · vence ${dateBR(b.due)}</small></div><div class="list-side"><strong>${money(b.amount)}</strong><small class="${cls}">${label}</small></div><div class="list-tools"><button class="mini-action" data-toggle-bill="${safeText(b.id)}" title="${b.paid?"Marcar pendente":"Marcar paga"}">${b.paid?"↶":"✓"}</button><button class="mini-action" data-edit-bill="${safeText(b.id)}" title="Editar">✎</button><button class="mini-action" data-delete-bill="${safeText(b.id)}" title="Excluir">×</button></div></div>`;
    }).join("");
    $("billsEmpty").style.display = bills.length ? "none" : "block";
  }
  function renderDebts() {
    $("debtsList").innerHTML = state.debts.map(d => {
      const remaining = Math.max(0,d.total-d.paid), pct = Math.min(100,Math.round(d.paid/d.total*100));
      return `<div class="list-item"><div class="list-icon">▱</div><div class="list-main"><strong>${safeText(d.name)}</strong><small>${d.due ? "Próximo vencimento: "+dateBR(d.due) : "Sem vencimento informado"} · ${pct}% pago</small><div class="progress-track" style="margin:7px 0 0;height:5px"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="list-side"><strong>${money(remaining)}</strong><small>restante</small></div><div class="list-tools"><button class="mini-action" data-edit-debt="${safeText(d.id)}" title="Editar">✎</button><button class="mini-action" data-delete-debt="${safeText(d.id)}" title="Excluir">×</button></div></div>`;
    }).join("");
    $("debtsEmpty").style.display = state.debts.length ? "none" : "block";
  }
  function renderCharts() {
    if (typeof Chart === "undefined") {
      document.querySelectorAll(".chart-wrap,.donut-wrap").forEach(el => { el.innerHTML = '<p class="empty-state">Para visualizar os gráficos, conecte-se à internet e recarregue a página.</p>'; });
      return;
    }
    const labels=[], incomes=[], expenses=[];
    const [year, month] = selectedMonth().split("-").map(Number);
    for(let i=5;i>=0;i--) {
      const d = new Date(year, month-1-i, 1);
      const key = monthISO(d);
      labels.push(d.toLocaleDateString("pt-BR",{month:"short"}).replace(".",""));
      const tx = txForMonth(key);
      incomes.push(sum(tx.filter(t=>t.type==="income"),t=>t.amount));
      expenses.push(sum(tx.filter(t=>t.type==="expense"),t=>t.amount));
    }
    if(flowChart) flowChart.destroy();
    flowChart = new Chart($("flowChart"), {
      type:"bar", data:{labels,datasets:[
        {label:"Entradas",data:incomes,backgroundColor:"#81e59a",borderRadius:5,borderSkipped:false,barPercentage:.55,categoryPercentage:.62},
        {label:"Saídas",data:expenses,backgroundColor:"#385343",borderRadius:5,borderSkipped:false,barPercentage:.55,categoryPercentage:.62}
      ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${money(c.raw)}`}}},scales:{x:{grid:{display:false},ticks:{color:"#829187",font:{family:"DM Sans",size:10}},border:{display:false}},y:{beginAtZero:true,grid:{color:"#263029"},ticks:{color:"#829187",font:{family:"DM Sans",size:9},callback:v=>shortMoney(v)},border:{display:false}}}}
    });
    const monthExpenses = txForMonth(selectedMonth()).filter(t=>t.type==="expense");
    const sums = {};
    monthExpenses.forEach(t=>sums[t.category]=(sums[t.category]||0)+t.amount);
    const sorted = Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,8);
    const chartLabels = sorted.length ? sorted.map(x=>x[0]) : ["Sem despesas"];
    const chartValues = sorted.length ? sorted.map(x=>x[1]) : [1];
    if(categoryChart) categoryChart.destroy();
    categoryChart = new Chart($("categoryChart"), {
      type:"doughnut",data:{labels:chartLabels,datasets:[{data:chartValues,backgroundColor:sorted.length?categoryColors.slice(0,sorted.length):["#29332b"],borderColor:"#141a16",borderWidth:4,hoverOffset:4}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:"76%",plugins:{legend:{display:false},tooltip:{enabled:!!sorted.length,callbacks:{label:c=>`${c.label}: ${money(c.raw)}`}}}}
    });
    $("donutTotal").textContent = shortMoney(sum(monthExpenses,t=>t.amount));
    $("categoryLegend").innerHTML = sorted.map(([name,value],i)=>`<div class="legend-item"><span class="legend-swatch" style="background:${categoryColors[i%categoryColors.length]}"></span><span class="legend-name">${safeText(name)}</span><span class="legend-value">${shortMoney(value)}</span></div>`).join("") || '<p class="empty-state" style="grid-column:1/-1">Adicione despesas para ver as categorias.</p>';
  }

  function fillCategories(type, selected) {
    $("txCategory").innerHTML = categories[type].map(c=>`<option ${c===selected?"selected":""}>${c}</option>`).join("");
  }
  function resetTransactionForm() {
    $("transactionForm").reset(); $("transactionId").value=""; $("transactionModalTitle").textContent="Nova movimentação";
    $("txDate").value=todayISO(); fillCategories("income"); error("txError");
  }
  function openTransaction(id) {
    resetTransactionForm();
    if(id) {
      const t=state.transactions.find(x=>x.id===id); if(!t) return;
      $("transactionId").value=t.id; $("transactionModalTitle").textContent="Editar movimentação";
      document.querySelector(`input[name="type"][value="${t.type}"]`).checked=true;
      $("txDescription").value=t.description; $("txAmount").value=t.amount; $("txDate").value=t.date;
      fillCategories(t.type,t.category); $("txAccount").value=t.account||"Conta corrente"; $("txNote").value=t.note||"";
    }
    openDialog("transactionDialog");
  }
  document.querySelectorAll('input[name="type"]').forEach(r=>r.addEventListener("change",()=>fillCategories(document.querySelector('input[name="type"]:checked').value)));
  $("transactionForm").addEventListener("submit",e=>{
    e.preventDefault(); error("txError");
    const type=document.querySelector('input[name="type"]:checked').value, description=$("txDescription").value.trim(), amount=num("txAmount"), date=$("txDate").value;
    if(!description) return error("txError","Informe uma descrição.");
    if(!validPositive(amount)) return error("txError","Informe um valor maior que zero e válido.");
    if(!date || date> "9999-12-31") return error("txError","Informe uma data válida.");
    const id=$("transactionId").value;
    const tx={id:id||uid(),type,description,amount:Math.round(amount*100)/100,date,category:$("txCategory").value,account:$("txAccount").value,note:$("txNote").value.trim()};
    if(id) state.transactions=state.transactions.map(t=>t.id===id?tx:t); else state.transactions.push(tx);
    persist(); render(); closeDialog("transactionDialog"); showToast(id?"Movimentação atualizada!":"Movimentação salva!");
  });

  function openGoal(id) {
    $("goalForm").reset(); $("goalId").value=""; $("goalSaved").value="0"; $("goalModalTitle").textContent="Nova meta"; error("goalError");
    if(id) { const g=state.goals.find(x=>x.id===id); if(!g)return; $("goalId").value=g.id; $("goalName").value=g.name; $("goalTarget").value=g.target; $("goalSaved").value=g.saved; $("goalDate").value=g.due||""; $("goalModalTitle").textContent="Editar meta"; }
    openDialog("goalDialog");
  }
  $("goalForm").addEventListener("submit",e=>{
    e.preventDefault(); error("goalError"); const name=$("goalName").value.trim(), target=num("goalTarget"), saved=num("goalSaved"), due=$("goalDate").value;
    if(!name)return error("goalError","Dê um nome para a meta.");
    if(!validPositive(target))return error("goalError","O valor da meta deve ser maior que zero.");
    if(!validNonNegative(saved))return error("goalError","O valor guardado não pode ser negativo.");
    if(saved>target)return error("goalError","O valor guardado não pode superar o valor desejado.");
    const id=$("goalId").value, goal={id:id||uid(),name,target:Math.round(target*100)/100,saved:Math.round(saved*100)/100,due};
    if(id)state.goals=state.goals.map(g=>g.id===id?goal:g);else state.goals.push(goal);
    persist();render();closeDialog("goalDialog");showToast("Meta salva!");
  });

  function openBill(id) {
    $("billForm").reset(); $("billId").value=""; $("billDue").value=todayISO(); $("billModalTitle").textContent="Nova conta"; error("billError");
    if(id){const b=state.bills.find(x=>x.id===id);if(!b)return;$("billId").value=b.id;$("billName").value=b.name;$("billAmount").value=b.amount;$("billDue").value=b.due;$("billCategory").value=b.category;$("billModalTitle").textContent="Editar conta";}
    openDialog("billDialog");
  }
  $("billForm").addEventListener("submit",e=>{
    e.preventDefault();error("billError");const name=$("billName").value.trim(),amount=num("billAmount"),due=$("billDue").value;
    if(!name)return error("billError","Informe o nome da conta.");
    if(!validPositive(amount))return error("billError","Informe um valor maior que zero.");
    if(!due)return error("billError","Informe a data de vencimento.");
    const id=$("billId").value, old=state.bills.find(b=>b.id===id), bill={id:id||uid(),name,amount:Math.round(amount*100)/100,due,category:$("billCategory").value,paid:old?old.paid:false};
    if(id)state.bills=state.bills.map(b=>b.id===id?bill:b);else state.bills.push(bill);
    persist();render();closeDialog("billDialog");showToast("Conta salva!");
  });

  function openDebt(id) {
    $("debtForm").reset();$("debtId").value="";$("debtPaid").value="0";$("debtDue").value="";$("debtModalTitle").textContent="Nova dívida ou cartão";error("debtError");
    if(id){const d=state.debts.find(x=>x.id===id);if(!d)return;$("debtId").value=d.id;$("debtName").value=d.name;$("debtTotal").value=d.total;$("debtPaid").value=d.paid;$("debtDue").value=d.due||"";$("debtModalTitle").textContent="Editar dívida ou cartão";}
    openDialog("debtDialog");
  }
  $("debtForm").addEventListener("submit",e=>{
    e.preventDefault();error("debtError");const name=$("debtName").value.trim(),total=num("debtTotal"),paid=num("debtPaid"),due=$("debtDue").value;
    if(!name)return error("debtError","Informe o nome da dívida.");
    if(!validPositive(total))return error("debtError","O total deve ser maior que zero.");
    if(!validNonNegative(paid))return error("debtError","O valor pago não pode ser negativo.");
    if(paid>total)return error("debtError","O valor pago não pode superar o total.");
    const id=$("debtId").value,debt={id:id||uid(),name,total:Math.round(total*100)/100,paid:Math.round(paid*100)/100,due};
    if(id)state.debts=state.debts.map(d=>d.id===id?debt:d);else state.debts.push(debt);
    persist();render();closeDialog("debtDialog");showToast("Dívida salva!");
  });

  document.addEventListener("click",e=>{
    const target=e.target.closest("button"); if(!target)return;
    if(target.dataset.close){closeDialog(target.dataset.close);return;}
    if(target.id==="quickAddBtn"){openTransaction();return;}
    if(target.id==="addGoalBtn"){openGoal();return;}
    if(target.id==="addBillBtn"){openBill();return;}
    if(target.id==="addDebtBtn"){openDebt();return;}
    if(target.id==="seeAllBtn"){document.querySelector("#transactions table").scrollIntoView({behavior:"smooth",block:"center"});return;}
    if(target.dataset.editTx){openTransaction(target.dataset.editTx);return;}
    if(target.dataset.deleteTx){const t=state.transactions.find(x=>x.id===target.dataset.deleteTx);if(t&&confirm(`Excluir a movimentação "${t.description}"?`)){state.transactions=state.transactions.filter(x=>x.id!==t.id);persist();render();showToast("Movimentação excluída.");}return;}
    if(target.dataset.editGoal){openGoal(target.dataset.editGoal);return;}
    if(target.dataset.deleteGoal){const g=state.goals.find(x=>x.id===target.dataset.deleteGoal);if(g&&confirm(`Excluir a meta "${g.name}"?`)){state.goals=state.goals.filter(x=>x.id!==g.id);persist();render();showToast("Meta excluída.");}return;}
    if(target.dataset.addSaving){const g=state.goals.find(x=>x.id===target.dataset.addSaving);if(!g)return;const raw=prompt(`Quanto deseja acrescentar à meta "${g.name}"? (R$)`);if(raw===null)return;const amount=Number(raw.replace(/\./g,"").replace(",", "."));if(!validPositive(amount))return showToast("Digite um valor válido maior que zero.");g.saved=Math.min(g.target,Math.round((g.saved+amount)*100)/100);persist();render();showToast("Progresso da meta atualizado!");return;}
    if(target.dataset.editBill){openBill(target.dataset.editBill);return;}
    if(target.dataset.deleteBill){const b=state.bills.find(x=>x.id===target.dataset.deleteBill);if(b&&confirm(`Excluir a conta "${b.name}"?`)){state.bills=state.bills.filter(x=>x.id!==b.id);persist();render();showToast("Conta excluída.");}return;}
    if(target.dataset.toggleBill){const b=state.bills.find(x=>x.id===target.dataset.toggleBill);if(b){b.paid=!b.paid;if(b.paid&&!state.transactions.some(t=>t.linkedBillId===b.id)){state.transactions.push({id:uid(),type:"expense",description:b.name,amount:b.amount,date:todayISO(),category:b.category,account:"Conta corrente",note:"Conta marcada como paga",linkedBillId:b.id});}else if(!b.paid){state.transactions=state.transactions.filter(t=>t.linkedBillId!==b.id);}persist();render();showToast(b.paid?"Conta marcada como paga.":"Conta marcada como pendente.");}return;}
    if(target.dataset.editDebt){openDebt(target.dataset.editDebt);return;}
    if(target.dataset.deleteDebt){const d=state.debts.find(x=>x.id===target.dataset.deleteDebt);if(d&&confirm(`Excluir "${d.name}"?`)){state.debts=state.debts.filter(x=>x.id!==d.id);persist();render();showToast("Dívida excluída.");}return;}
  });
  $("monthFilter").value=monthISO(); $("monthFilter").addEventListener("change",render);
  $("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.querySelectorAll(".nav-link").forEach(link=>link.addEventListener("click",()=>{document.querySelectorAll(".nav-link").forEach(a=>a.classList.remove("active"));link.classList.add("active");$("sidebar").classList.remove("open");}));
  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({app:"Verde Financeiro",version:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`verde-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(url);showToast("Backup exportado!");
  });
  $("importBtn").addEventListener("click",()=>$("importFile").click());
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!data||!Array.isArray(data.transactions)||!Array.isArray(data.goals)||!Array.isArray(data.bills)||!Array.isArray(data.debts))throw new Error("Formato inválido");
      if(!confirm("Importar este backup vai substituir os dados atuais. Deseja continuar?"))return;
      state={transactions:data.transactions,goals:data.goals,bills:data.bills,debts:data.debts};persist();render();showToast("Backup importado!");
    }catch(err){showToast("Arquivo inválido. Selecione um backup JSON do Verde.");}
    finally{e.target.value="";}
  });
  window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY){state=loadState();render();}});
  render();
})();