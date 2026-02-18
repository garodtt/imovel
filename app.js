// 1. CONFIGURAÇÃO E CONEXÃO
if (!window.supabaseCon) {
    const SUPABASE_URL = "https://ydxsymonbvbvjvouzlvg.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkeHN5bW9uYnZidmp2b3V6bHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzM5NDEsImV4cCI6MjA4MzQ0OTk0MX0.bS97qYE053X0A3_x9Pk1lkR731vJjaH-4gwQMPUq0n0";
    window.supabaseCon = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
const db = window.supabaseCon;

let idEdicao = null;
let chartCenarios = null;
let chartComposicao = null;

// 2. NAVEGAÇÃO E UI
window.navegar = function(secao) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${secao}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${secao}`).classList.add('active');
    if (secao === 'dash' || secao === 'lista' || secao === 'contas') carregarDados();
};

window.abrirModal = () => {
    idEdicao = null;
    document.getElementById("form-imovel").reset();
    document.getElementById("modal-titulo").innerText = "Novo Imóvel";
    document.getElementById("btn-excluir").classList.add("hidden");
    document.getElementById("modal").classList.remove("hidden");
    trocarAba(null, 'aba-basico');
};

window.fecharModal = () => document.getElementById("modal").classList.add("hidden");

window.trocarAba = function(event, abaId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(abaId).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');
};

// 3. SALVAR / EDITAR / EXCLUIR (Lógica Original Mantida)
window.salvarImovel = async function() {
    const imovel = {
        nome: document.getElementById("nome").value,
        tipo: document.getElementById("tipo").value,
        status: document.getElementById("status").value,
        area_total: Number(document.getElementById("area_total").value) || 0,
        valor_compra: Number(document.getElementById("valor_compra").value) || 0,
        itbi: Number(document.getElementById("custos_extras_compra").value) || 0,
        valor_reforma_inicial: Number(document.getElementById("valor_reforma_inicial").value) || 0,
        parcela_financiamento: Number(document.getElementById("parcela_financiamento").value) || 0,
        valor_aluguel: Number(document.getElementById("valor_aluguel").value) || 0,
        condominio: Number(document.getElementById("condominio").value) || 0,
        iptu_mensal: Number(document.getElementById("iptu_mensal").value) || 0,
        taxa_adm_percentual: Number(document.getElementById("taxa_adm_percentual").value) || 0,
        manutencao_media: Number(document.getElementById("custos_variaveis_media").value) || 0
    };

    let erro;
    if (idEdicao) {
        const { error } = await db.from("imoveis").update(imovel).eq("id", idEdicao);
        erro = error;
    } else {
        const { error } = await db.from("imoveis").insert([imovel]);
        erro = error;
    }

    if (erro) return alert("Erro ao salvar.");
    fecharModal();
    carregarDados();
};

window.prepararEdicao = async function(id) {
    const { data: i } = await db.from("imoveis").select("*").eq("id", id).single();
    idEdicao = id;
    document.getElementById("modal-titulo").innerText = "Editar Imóvel";
    document.getElementById("btn-excluir").classList.remove("hidden");
    document.getElementById("nome").value = i.nome;
    document.getElementById("tipo").value = i.tipo;
    document.getElementById("status").value = i.status;
    document.getElementById("valor_compra").value = i.valor_compra;
    document.getElementById("valor_aluguel").value = i.valor_aluguel;
    // ... preencher os demais campos conforme seu HTML ...
    document.getElementById("modal").classList.remove("hidden");
};

window.excluirImovel = async function() {
    if (!confirm("Excluir definitivamente?")) return;
    await db.from("imoveis").delete().eq("id", idEdicao);
    fecharModal();
    carregarDados();
};

// 4. LÓGICA DE GRÁFICOS E CENÁRIOS
function renderizarGraficos(imoveis, lucroMensal, custosFixosVagos) {
    // A. CENÁRIOS (Anual)
    const anualOtimista = lucroMensal * 12; // 100% ocupado
    const anualRealista = (lucroMensal * 10.5) - (custosFixosVagos * 1.5); // 90% ocupado (1.5 mês vago)
    const anualPessimista = (lucroMensal * 8) - (custosFixosVagos * 4); // 65% ocupado (4 meses vago)

    if (chartCenarios) chartCenarios.destroy();
    const ctx1 = document.getElementById('chartCenarios').getContext('2d');
    chartCenarios = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Pessimista', 'Realista', 'Otimista'],
            datasets: [{
                label: 'Lucro Líquido Anual Est.',
                data: [anualPessimista, anualRealista, anualOtimista],
                backgroundColor: ['#ef4444', '#3b82f6', '#22c55e'],
                borderRadius: 10
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    // B. COMPOSIÇÃO (Pizza)
    const tipos = {};
    imoveis.forEach(i => tipos[i.tipo] = (tipos[i.tipo] || 0) + (i.valor_compra || 0));

    if (chartComposicao) chartComposicao.destroy();
    const ctx2 = document.getElementById('chartComposicao').getContext('2d');
    chartComposicao = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(tipos),
            datasets: [{
                data: Object.values(tipos),
                backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6']
            }]
        },
        options: { responsive: true, cutout: '70%' }
    });
}

// 5. CARREGAR DADOS (MÉTRICAS + GRÁFICOS)
async function carregarDados() {
    const { data: imoveis, error } = await db.from("imoveis").select("*");
    if (error) return;

    const filtroStatus = document.getElementById("filtro-status").value;
    let totalPatrimonio = 0, totalInvestido = 0, totalLucroMensal = 0, custosFixosVagos = 0;
    
    const grid = document.getElementById("grid-imoveis");
    const tabela = document.getElementById("lista-contas-body");
    grid.innerHTML = ""; tabela.innerHTML = "";

    imoveis.forEach(i => {
        const custoTotal = (i.valor_compra || 0) + (i.itbi || 0) + (i.valor_reforma_inicial || 0);
        const receita = i.valor_aluguel || 0;
        const despesas = (i.condominio || 0) + (i.iptu_mensal || 0) + (i.parcela_financiamento || 0) + (i.manutencao_media || 0);
        const taxaAdm = receita * ((i.taxa_adm_percentual || 0) / 100);
        const fluxo = receita - despesas - taxaAdm;

        // Acumuladores Dashboard
        totalPatrimonio += (i.valor_compra || 0);
        totalInvestido += custoTotal;
        totalLucroMensal += fluxo;
        custosFixosVagos += (i.condominio || 0) + (i.iptu_mensal || 0); // O que paga se ficar vago

        // Filtro de Interface
        if (filtroStatus === "todos" || i.status === filtroStatus) {
            grid.innerHTML += `
                <div class="property-card">
                    <div class="card-header">
                        <span class="status-badge ${i.status}">${i.status.toUpperCase()}</span>
                        <button class="btn-edit-small" onclick="prepararEdicao('${i.id}')"><i class="fa-solid fa-pen"></i></button>
                        <h3>${i.nome}</h3>
                    </div>
                    <div class="card-body">
                        <p><strong>Fluxo:</strong> R$ ${fluxo.toLocaleString('pt-BR')}</p>
                        <p><strong>Yield:</strong> ${(custoTotal > 0 ? (fluxo / custoTotal) * 100 : 0).toFixed(2)}% am</p>
                    </div>
                </div>`;
            tabela.innerHTML += `
                <tr>
                    <td>${i.nome}</td>
                    <td class="text-green">R$ ${receita.toFixed(2)}</td>
                    <td>R$ ${(i.condominio || 0).toFixed(2)}</td>
                    <td>R$ ${(i.iptu_mensal || 0).toFixed(2)}</td>
                    <td>R$ ${(i.manutencao_media || 0).toFixed(2)}</td>
                    <td>R$ ${(i.parcela_financiamento || 0).toFixed(2)}</td>
                    <td class="${fluxo >= 0 ? 'text-green' : 'text-red'} font-bold">R$ ${fluxo.toFixed(2)}</td>
                </tr>`;
        }
    });

    // Atualizar UI
    document.getElementById("val-patrimonio").innerText = `R$ ${totalPatrimonio.toLocaleString('pt-BR')}`;
    document.getElementById("receita-mensal").innerText = `R$ ${totalLucroMensal.toLocaleString('pt-BR')}`;
    document.getElementById("yield-medio").innerText = `${(totalInvestido > 0 ? ((totalLucroMensal * 12) / totalInvestido) * 100 : 0).toFixed(2)}%`;
    document.getElementById("payback-medio").innerText = `${totalLucroMensal > 0 ? Math.round(totalInvestido / totalLucroMensal) : 0} meses`;
    document.getElementById("total-ativos").innerText = imoveis.length;
    document.getElementById("previsao-reajuste").innerText = `R$ ${(totalLucroMensal * 1.05).toLocaleString('pt-BR')}`; // Est. 5% reajuste

    renderizarGraficos(imoveis, totalLucroMensal, custosFixosVagos);
}

document.addEventListener("DOMContentLoaded", () => carregarDados());