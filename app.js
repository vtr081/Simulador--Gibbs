"use strict";
/**
 * Simulador: Energia Livre de Gibbs e Espontaneidade
 * Fórmula: ΔG = ΔH − T·ΔS   (ΔH em kJ/mol, ΔS em J/(mol·K), T em K)
 */
const KELVIN_OFFSET = 273.15;
const TOLERANCIA_EQUILIBRIO = 0.005; // |ΔG| < 0,005 kJ/mol aparece como 0,00 → equilíbrio
const estado = { dH: -92.2, dS: -198.7, T: 298.15, unidade: "K" };
// Predefinições (valores aproximados a 298 K)
const PRESETS = {
    sempre: { dH: -393.5, dS: 2.9, T: 298.15 }, // exotérmica, ΔS > 0
    nunca: { dH: 142.7, dS: -68.6, T: 298.15 }, // endotérmica, ΔS < 0
    baixa: { dH: -92.2, dS: -198.7, T: 298.15 }, // exotérmica, ΔS < 0
    alta: { dH: 57.2, dS: 175.8, T: 298.15 }, // endotérmica, ΔS > 0
};
/* ---------- Funções de cálculo ---------- */
/** Calcula ΔG em kJ/mol. ΔS é convertido de J para kJ (÷ 1000). */
function calcularDeltaG(dH, dS, T) {
    const dSemKJ = dS / 1000;
    return dH - T * dSemKJ;
}
/** T_eq = ΔH / ΔS (em K). Retorna null se não existir temperatura positiva de equilíbrio. */
function temperaturaEquilibrio(dH, dS) {
    if (dS === 0)
        return null;
    const t = dH / (dS / 1000);
    return t > 0 ? t : null;
}
/** Formata número em pt-BR evitando "-0,00". */
function fmt(n, casas = 2) {
    if (Math.abs(n) < 0.5 * Math.pow(10, -casas))
        n = 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
const arredondar = (n, casas = 1) => {
    const f = Math.pow(10, casas);
    return Math.round(n * f) / f;
};
/* ---------- Referências do DOM ---------- */
const $ = (id) => document.getElementById(id);
const slDH = $("sl-dh"), inDH = $("in-dh");
const slDS = $("sl-ds"), inDS = $("in-ds");
const slT = $("sl-t"), inT = $("in-t");
const btnK = $("btn-k"), btnC = $("btn-c");
const tUn = $("t-un");
const cardStatus = $("card-status");
const dgValor = $("dg-valor"), badge = $("status-badge");
const meterFill = $("meter-fill");
const teqValor = $("teq-valor"), teqNota = $("teq-nota");
const explTexto = $("expl-texto"), calcLinha = $("calc-linha");
/* ---------- Sincronização slider ↔ input ---------- */
/** Liga um slider a um campo numérico; `aoMudar` recebe o valor (já limitado ao intervalo). */
function vincular(slider, input, aoMudar) {
    slider.addEventListener("input", () => {
        const v = arredondar(parseFloat(slider.value));
        input.value = String(v);
        aoMudar(v);
    });
    input.addEventListener("input", () => {
        const v = parseFloat(input.value);
        if (Number.isNaN(v))
            return; // campo vazio enquanto o aluno digita
        const limitado = Math.min(Math.max(v, parseFloat(slider.min)), parseFloat(slider.max));
        slider.value = String(limitado);
        aoMudar(limitado);
    });
    
    input.addEventListener("change", () => { input.value = String(arredondar(parseFloat(slider.value), 2)); });
}

function limparPreset() {
    document.querySelectorAll(".presets button").forEach((b) => b.classList.remove("ativo"));
}

function paraExibicao(tK) {
    return estado.unidade === "K" ? tK : tK - KELVIN_OFFSET;
}
function atualizarControleT() {
    const min = estado.unidade === "K" ? 0 : -KELVIN_OFFSET;
    const max = estado.unidade === "K" ? 1000 : 1000 - KELVIN_OFFSET;
    [slT, inT].forEach((el) => { el.min = String(min); el.max = String(max); });
    const v = arredondar(paraExibicao(estado.T), 2);
    slT.value = String(v);
    inT.value = String(v);
    tUn.textContent = estado.unidade === "K" ? "K" : "°C";
    btnK.setAttribute("aria-pressed", String(estado.unidade === "K"));
    btnC.setAttribute("aria-pressed", String(estado.unidade === "C"));
}
function definirUnidade(u) {
    estado.unidade = u;
    atualizarControleT();
    render();
}

function sincronizarControles() {
    slDH.value = inDH.value = String(estado.dH);
    slDS.value = inDS.value = String(estado.dS);
    atualizarControleT();
}
/* ---- Explicação ---- */
function explicar(dH, dS, teq) {
    const calor = dH < 0 ? "ΔH é negativo (a reação <strong>libera calor</strong>, é exotérmica)"
        : dH > 0 ? "ΔH é positivo (a reação <strong>absorve calor</strong>, é endotérmica)"
            : "ΔH é zero (não há troca líquida de calor)";
    const desordem = dS > 0 ? "ΔS é positivo (a <strong>desordem aumenta</strong>)"
        : dS < 0 ? "ΔS é negativo (a <strong>desordem diminui</strong>)"
            : "ΔS é zero (a desordem não muda)";
    let conclusao;
    if (dH < 0 && dS > 0) {
        conclusao = "esta reação é espontânea em <strong>QUALQUER temperatura</strong>: os dois fatores favorecem o processo.";
    }
    else if (dH > 0 && dS < 0) {
        conclusao = "esta reação <strong>NÃO é espontânea em nenhuma temperatura</strong>: os dois fatores trabalham contra o processo.";
    }
    else if (dH < 0 && dS < 0 && teq !== null) {
        conclusao = `esta reação é espontânea apenas em <strong>BAIXAS temperaturas</strong> (abaixo de ${fmt(teq, 1)} K). Em temperaturas altas, o termo −T·ΔS fica grande e positivo e vence o calor liberado.`;
    }
    else if (dH > 0 && dS > 0 && teq !== null) {
        conclusao = `esta reação é espontânea apenas em <strong>ALTAS temperaturas</strong> (acima de ${fmt(teq, 1)} K), quando T·ΔS se torna maior que o calor absorvido.`;
    }
    else if (dH === 0 && dS === 0) {
        conclusao = "ΔG vale zero em qualquer temperatura: o sistema está sempre em equilíbrio.";
    }
    else if (dS === 0) {
        conclusao = dH < 0
            ? "ΔG = ΔH, então a reação é espontânea em <strong>qualquer temperatura</strong>."
            : "ΔG = ΔH, então a reação <strong>não é espontânea</strong> em nenhuma temperatura.";
    }
    else {
        conclusao = dS > 0
            ? "ΔG = −T·ΔS, então a reação é espontânea em qualquer temperatura acima de 0 K."
            : "ΔG = −T·ΔS, então a reação não é espontânea em nenhuma temperatura acima de 0 K.";
    }
    return `<p>Como ${calor} e ${desordem}, ${conclusao}</p>`;
}

function render() {
    const { dH, dS, T } = estado;
    const dG = calcularDeltaG(dH, dS, T);
    const teq = temperaturaEquilibrio(dH, dS);

    let situacao;
    let rotulo;
    if (Math.abs(dG) < TOLERANCIA_EQUILIBRIO) {
        situacao = "equilibrium";
        rotulo = "⚖️ Equilíbrio químico (ΔG = 0)";
    }
    else if (dG < 0) {
        situacao = "spontaneous";
        rotulo = "✅ Espontâneo (exergônico)";
    }
    else {
        situacao = "nonspontaneous";
        rotulo = "⛔ Não espontâneo (endergônico)";
    }
    cardStatus.dataset.state = situacao;
    badge.textContent = rotulo;
    dgValor.textContent = fmt(dG);

    const largura = Math.min(Math.abs(dG) / 1000, 1) * 50;
    meterFill.style.width = `${largura}%`;
    meterFill.style.left = dG < 0 ? `${50 - largura}%` : "50%";

    if (teq !== null) {
        teqValor.textContent = `${fmt(teq, 1)} K (${fmt(teq - KELVIN_OFFSET, 1)} °C)`;
        teqNota.textContent = teq > 1000
            ? "Fora da faixa do simulador (acima de 1000 K)."
            : "Nessa temperatura, ΔG = 0 e a espontaneidade se inverte.";
    }
    else {
        teqValor.textContent = "Não se aplica";
        teqNota.textContent = "Não existe temperatura positiva em que ΔG = 0 (ΔH e ΔS não têm o mesmo sinal ou um deles é zero).";
    }
    
    explTexto.innerHTML = explicar(dH, dS, teq);
    calcLinha.textContent =
        `ΔG = ΔH − T·(ΔS/1000) = ${fmt(dH)} − (${fmt(T)} × ${fmt(dS / 1000, 4)}) = ${fmt(dG)} kJ/mol`;
}

vincular(slDH, inDH, (v) => { estado.dH = v; limparPreset(); render(); });
vincular(slDS, inDS, (v) => { estado.dS = v; limparPreset(); render(); });
vincular(slT, inT, (v) => {
    estado.T = estado.unidade === "K" ? v : v + KELVIN_OFFSET; 
    limparPreset();
    render();
});
btnK.addEventListener("click", () => definirUnidade("K"));
btnC.addEventListener("click", () => definirUnidade("C"));
document.querySelectorAll(".presets button").forEach((botao) => {
    botao.addEventListener("click", () => {
        const p = PRESETS[botao.dataset.preset ?? ""];
        if (!p)
            return;
        estado.dH = p.dH;
        estado.dS = p.dS;
        estado.T = p.T;
        sincronizarControles();
        limparPreset();
        botao.classList.add("ativo");
        render();
    });
});

$("btn-tema").addEventListener("click", () => {
  const raiz = document.documentElement;
  const atual = raiz.dataset.tema ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  raiz.dataset.tema = atual === "dark" ? "light" : "dark";
});

sincronizarControles();
render();