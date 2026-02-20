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

// --- DICIONÁRIO DE INFORMAÇÕES ---
const explicacoes = {
    noi: { titulo: "Fluxo Mensal (NOI)", texto: "Receita Operacional Líquida: Aluguel menos despesas fixas e taxa de ADM, antes do IR." },
    ir: { titulo: "Imposto de Renda Est.", texto: "Cálculo baseado na tabela progressiva mensal. Isento até R$ 2.259, chegando a 27,5% sobre valores maiores." },
    caprate: { titulo: "Cap Rate Anual", texto: "Retorno anual sobre o capital investido. (Lucro Líquido Anual / Custo Total) x 100." },
    payback: { titulo: "Payback Estimado", texto: "Tempo necessário (em meses) para o lucro acumulado pagar o custo de aquisição e reforma." },
    cenarios: { titulo: "Legenda dos Cenários", texto: "• Otimista: 100% ocupado.\n• Realista: 1 mês vago/ano.\n• Pessimista: 4 meses vago/ano." },
    composicao: { titulo: "Composição", texto: "Distribuição do valor investido por categoria de imóvel." },
    reajuste: { titulo: "Previsão 12m", texto: "Estimativa de crescimento de 5% sobre a receita atual por reajustes contratuais." }
};

// --- FUNÇÕES DE CÁLCULO FINANCEIRO ---

function calcularIR(valorBase) {
    if (valorBase <= 2259) return 0;
    if (valorBase <= 2826.65) return (valorBase * 0.075) - 169.44;
    if (valorBase <= 3751.05) return (valorBase * 0.15) - 381.44;
    if (valorBase <= 4664.68) return (valorBase * 0.225) - 662.77;
    return (valorBase * 0.275) - 896.00;
}

function calcularScoreRisco(status, tipo) {
    if (status === 'vago') return 100;
    if (status === 'reforma') return 70;
    return tipo === 'Comercial' ? 30 : 15;
}

// --- NOVO: LÓGICA DE INTELIGÊNCIA (VENDER VS ALUGAR) ---
window.calcularInteligencia = function() {
    const valorMercado = Number(document.getElementById("valor_venda_desejado").value) || Number(document.getElementById("valor_compra").value) || 0;
    const aluguelBruto = Number(document.getElementById("valor_aluguel").value) || 0;
    const condominio = Number(document.getElementById("condominio").value) || 0;
    const iptu = Number(document.getElementById("iptu_mensal").value) || 0;
    const taxaAdm = aluguelBruto * (Number(document.getElementById("taxa_adm_percentual").value) / 100);
    
    // Cálculo do IR sobre a base tributável (Aluguel - Deduções fixas permitidas)
    const baseIR = Math.max(0, aluguelBruto - condominio - iptu);
    const irMensal = calcularIR(baseIR); 

    const aluguelLiquido = aluguelBruto - condominio - iptu - taxaAdm - irMensal;
    const rentabilidadeAluguel = valorMercado > 0 ? (aluguelLiquido / valorMercado) * 100 : 0;

    // Benchmark: CDI atual estimado em 0.85% ao mês (ajustável)
    const taxaCDI = 0.85; 
    const rendimentoVendaCDI = valorMercado * (taxaCDI / 100);

    const custoDiretoVago = condominio + iptu;
    const custoOportunidadeTotal = custoDiretoVago + aluguelLiquido + rendimentoVendaCDI;

    // Atualização da UI
    document.getElementById("calc-rent-aluguel").innerText = `${rentabilidadeAluguel.toFixed(2)}% am`;
    document.getElementById("custo-vago-direto").innerText = `R$ ${custoDiretoVago.toLocaleString('pt-BR')}`;
    document.getElementById("custo-vago-total").innerText = `R$ ${custoOportunidadeTotal.toLocaleString('pt-BR')}`;

    const veredito = document.getElementById("veredito-texto");
    if (rentabilidadeAluguel > taxaCDI) {
        veredito.innerHTML = `<b style="color:#22c55e">MANTER PARA ALUGUEL.</b> Sua rentabilidade líquida (${rentabilidadeAluguel.toFixed(2)}%) supera o CDI médio (${taxaCDI}%).`;
    } else {
        veredito.innerHTML = `<b style="color:#ef4444">VANTAGEM NA VENDA.</b> O aluguel rende menos que o CDI. Valor estimado de liquidez: R$ ${rendimentoVendaCDI.toLocaleString('pt-BR')}/mês no CDI.`;
    }
}

// --- FUNÇÕES DE UI ---
window.abrirInfo = (chave) => {
    const info = explicacoes[chave];
    if (info) {
        document.getElementById("info-titulo").innerText = info.titulo;
        document.getElementById("info-texto").innerText = info.texto;
        document.getElementById("modal-info").classList.remove("hidden");
    }
};

window.fecharInfo = () => document.getElementById("modal-info").classList.add("hidden");

window.navegar = (secao) => {
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(`sec-${secao}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${secao}`).classList.add('active');
    if (['dash', 'lista', 'contas'].includes(secao)) carregarDados();
};

window.abrirModal = () => {
    idEdicao = null;
    document.getElementById("form-imovel").reset();
    document.getElementById("modal-titulo").innerText = "Novo Imóvel";
    document.getElementById("btn-excluir").classList.add("hidden");
    document.getElementById("modal").classList.remove("hidden");
    trocarAba(null, 'aba-geral');
};

window.fecharModal = () => document.getElementById("modal").classList.add("hidden");

window.trocarAba = (event, abaId) => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(abaId).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.currentTarget.classList.add('active');

    // Se clicar na aba de inteligência, calcula os dados
    if (abaId === 'aba-inteligencia') calcularInteligencia();
};

// --- OPERAÇÕES DB ---
window.salvarImovel = async function() {
    const btn = document.querySelector(".btn-salvar");
    btn.disabled = true;
    btn.innerText = "Salvando...";

    const imovel = {
        nome: document.getElementById("nome").value,
        tipo: document.getElementById("tipo").value,
        status: document.getElementById("status").value,
        endereco: document.getElementById("endereco").value,
        cidade: document.getElementById("cidade").value,
        area_util: Number(document.getElementById("area_util").value),
        quartos: Number(document.getElementById("quartos").value),
        banheiros: Number(document.getElementById("banheiros").value),
        vagas: Number(document.getElementById("vagas").value),
        
        // Aquisição
        data_compra: document.getElementById("data_compra").value,
        valor_compra: Number(document.getElementById("valor_compra").value),
        custos_extras_compra: Number(document.getElementById("custos_extras_compra").value),
        comissao_compra: Number(document.getElementById("comissao_compra").value),
        forma_pagamento: document.getElementById("forma_pagamento").value,
        valor_financiado: Number(document.getElementById("valor_financiado").value),
        parcela_financiamento: Number(document.getElementById("parcela_financiamento").value),
        saldo_devedor: Number(document.getElementById("saldo_devedor").value),
        
        // Locação
        valor_aluguel: Number(document.getElementById("valor_aluguel").value),
        data_inicio_contrato: document.getElementById("data_inicio_contrato").value,
        data_fim_contrato: document.getElementById("data_fim_contrato").value,
        tipo_garantia: document.getElementById("tipo_garantia").value,
        inquilino_dados: document.getElementById("inquilino_dados").value,
        
        // Custos e Venda
        condominio: Number(document.getElementById("condominio").value),
        iptu_mensal: Number(document.getElementById("iptu_mensal").value),
        taxa_adm_percentual: Number(document.getElementById("taxa_adm_percentual").value),
        seguro_imovel: Number(document.getElementById("seguro_imovel").value),
        valor_venda_desejado: Number(document.getElementById("valor_venda_desejado").value),
        valor_reforma_inicial: Number(document.getElementById("valor_reforma_inicial").value),
        
        // Config
        vacancia_estimada: Number(document.getElementById("vacancia_estimada").value),
        aliquota_ir: Number(document.getElementById("aliquota_ir").value)
    };

    const { error } = idEdicao 
        ? await db.from("imoveis").update(imovel).eq("id", idEdicao)
        : await db.from("imoveis").insert([imovel]);

    btn.disabled = false;
    btn.innerText = "Salvar Patrimônio";

    if (error) {
        console.error(error);
        return alert("Erro ao salvar no banco de dados.");
    }
    
    fecharModal();
    carregarDados();
};

window.prepararEdicao = async function(id) {
    const { data: i } = await db.from("imoveis").select("*").eq("id", id).single();
    idEdicao = id;
    
    // Preenche todos os campos (Mapeamento completo)
    const campos = [
        "nome", "tipo", "status", "endereco", "cidade", "area_util", "quartos", "banheiros", "vagas",
        "data_compra", "valor_compra", "custos_extras_compra", "comissao_compra", "forma_pagamento",
        "valor_financiado", "parcela_financiamento", "saldo_devedor", "valor_aluguel", 
        "data_inicio_contrato", "data_fim_contrato", "tipo_garantia", "inquilino_dados",
        "condominio", "iptu_mensal", "taxa_adm_percentual", "seguro_imovel", 
        "valor_venda_desejado", "valor_reforma_inicial", "vacancia_estimada", "aliquota_ir"
    ];

    campos.forEach(campo => {
        const el = document.getElementById(campo);
        if (el) el.value = i[campo] || (el.type === 'number' ? 0 : '');
    });
    
    document.getElementById("modal-titulo").innerText = "Editar Imóvel";
    document.getElementById("btn-excluir").classList.remove("hidden");
    document.getElementById("modal").classList.remove("hidden");
    trocarAba(null, 'aba-geral');
};

window.excluirImovel = async function() {
    if (!confirm("Tem certeza que deseja remover este imóvel do patrimônio?")) return;
    const { error } = await db.from("imoveis").delete().eq("id", idEdicao);
    if (error) alert("Erro ao excluir.");
    fecharModal();
    carregarDados();
};

// --- GRÁFICOS ---
function renderizarGraficos(imoveis, lucroMensal, custosFixosVagos) {
    const ctxCenarios = document.getElementById('chartCenarios').getContext('2d');
    const ctxComposicao = document.getElementById('chartComposicao').getContext('2d');

    const dadosCenarios = [
        (lucroMensal * 8) - (custosFixosVagos * 4), 
        (lucroMensal * 10.5) - (custosFixosVagos * 1.5),
        lucroMensal * 12 
    ];

    if (chartCenarios) chartCenarios.destroy();
    chartCenarios = new Chart(ctxCenarios, {
        type: 'bar',
        data: {
            labels: ['Pessimista', 'Realista', 'Otimista'],
            datasets: [{ label: 'Lucro Líquido Anual Est.', data: dadosCenarios, backgroundColor: ['#ef4444', '#3b82f6', '#22c55e'], borderRadius: 8 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });

    const tipos = {};
    imoveis.forEach(i => tipos[i.tipo] = (tipos[i.tipo] || 0) + (i.valor_compra || 0));

    if (chartComposicao) chartComposicao.destroy();
    chartComposicao = new Chart(ctxComposicao, {
        type: 'doughnut',
        data: {
            labels: Object.keys(tipos),
            datasets: [{ data: Object.values(tipos), backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'] }]
        },
        options: { responsive: true, cutout: '70%' }
    });
}

// --- CARREGAMENTO PRINCIPAL ---
async function carregarDados() {
    const { data: imoveis, error } = await db.from("imoveis").select("*");
    if (error) return;

    const filtroStatus = document.getElementById("filtro-status").value;
    const grid = document.getElementById("grid-imoveis");
    const tabela = document.getElementById("lista-contas-body");
    
    grid.innerHTML = ""; tabela.innerHTML = "";

    let totPatrimonio = 0, totInvestido = 0, totLucroMensal = 0, totIR = 0, custosVagos = 0;

    imoveis.forEach(i => {
        const custoAquisicao = (i.valor_compra || 0) + (i.custos_extras_compra || 0) + (i.valor_reforma_inicial || 0);
        const receita = i.valor_aluguel || 0;
        const despesasFixas = (i.condominio || 0) + (i.iptu_mensal || 0) + (i.parcela_financiamento || 0);
        const taxaAdm = receita * ((i.taxa_adm_percentual || 0) / 100);
        
        const baseIR = Math.max(0, receita - (i.condominio || 0) - (i.iptu_mensal || 0));
        const ir = i.status === 'alugado' ? calcularIR(baseIR) : 0;
        
        const fluxoBruto = receita - despesasFixas - taxaAdm;
        const fluxoLiquidoReal = fluxoBruto - ir;
        const scoreRisco = calcularScoreRisco(i.status, i.tipo);

        totPatrimonio += (i.valor_venda_desejado || i.valor_compra || 0);
        totInvestido += custoAquisicao;
        totLucroMensal += fluxoBruto;
        totIR += ir;
        custosVagos += (i.condominio || 0) + (i.iptu_mensal || 0);

        if (filtroStatus === "todos" || i.status === filtroStatus) {
            grid.innerHTML += `
                <div class="property-card ${scoreRisco > 50 ? 'border-risk' : ''}">
                    <div class="card-header">
                        <span class="status-badge ${i.status}">${i.status.toUpperCase()}</span>
                        <div class="risk-tag">Risco Vacância: ${scoreRisco}%</div>
                        <button class="btn-edit-small" onclick="prepararEdicao('${i.id}')"><i class="fa-solid fa-pen"></i></button>
                        <h3>${i.nome}</h3>
                    </div>
                    <div class="card-body">
                        <p><strong>Fluxo Bruto:</strong> R$ ${fluxoBruto.toLocaleString('pt-BR')}</p>
                        <p class="text-red"><strong>IR Est.:</strong> - R$ ${ir.toLocaleString('pt-BR')}</p>
                        <p class="text-green font-bold"><strong>Líquido Real:</strong> R$ ${fluxoLiquidoReal.toLocaleString('pt-BR')}</p>
                    </div>
                </div>`;
            
            tabela.innerHTML += `
                <tr>
                    <td>${i.nome}</td>
                    <td class="text-green">R$ ${receita.toFixed(2)}</td>
                    <td>R$ ${despesasFixas.toFixed(2)}</td>
                    <td>R$ ${taxaAdm.toFixed(2)}</td>
                    <td class="text-red">R$ ${ir.toFixed(2)}</td>
                    <td class="font-bold">R$ ${fluxoLiquidoReal.toFixed(2)}</td>
                </tr>`;
        }
    });

    document.getElementById("val-patrimonio").innerText = `R$ ${totPatrimonio.toLocaleString('pt-BR')}`;
    document.getElementById("receita-mensal").innerText = `R$ ${totLucroMensal.toLocaleString('pt-BR')}`;
    document.getElementById("total-ir").innerText = `R$ ${totIR.toLocaleString('pt-BR')}`;
    document.getElementById("yield-medio").innerText = `${(totInvestido > 0 ? ((totLucroMensal * 12) / totInvestido) * 100 : 0).toFixed(2)}%`;
    document.getElementById("payback-medio").innerText = `${totLucroMensal > 0 ? Math.round(totInvestido / totLucroMensal) : 0} meses`;
    document.getElementById("total-ativos").innerText = imoveis.length;
    document.getElementById("previsao-reajuste").innerText = `R$ ${(totLucroMensal * 1.05).toLocaleString('pt-BR')}`;

    renderizarGraficos(imoveis, totLucroMensal, custosVagos);
}

document.addEventListener("DOMContentLoaded", carregarDados);
