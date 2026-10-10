let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const selectCanton = document.getElementById('canton');
    const selectDistrito = document.getElementById('distrito');
    const btnCalcular = document.getElementById('btnCalcular');
    const btnUbicacion = document.getElementById('btnUbicacion');

    setupToggles();
    setupModoTecnico();

    function actualizarDistritos() {
        const canton = selectCanton.value;
        const distritos = Calculator.distritosPorCanton[canton] || [];

        selectDistrito.innerHTML = '';
        distritos.forEach(dist => {
            const opt = document.createElement('option');
            opt.value = dist.toLowerCase().replace(/\s+/g, '_');
            opt.textContent = dist;
            selectDistrito.appendChild(opt);
        });
    }

    selectCanton.addEventListener('change', actualizarDistritos);
    actualizarDistritos();

    btnCalcular.addEventListener('click', ejecutarCalculo);

    document.getElementById('escenarioClima').addEventListener('change', ejecutarCalculo);

    document.getElementById('tempAguaAzolla').addEventListener('input', (e) => {
        const temp = parseFloat(e.target.value) || 0;
        const lblAlert = document.getElementById('lblAlertaAzolla');
        lblAlert.classList.toggle('hidden', temp <= 35);
        ejecutarCalculo();
    });

    document.getElementById('tipoGanado').addEventListener('change', (e) => {
        const tasa = Calculator.tasasGanado[e.target.value] || 50;
        document.getElementById('lblDotacionOficial').textContent = tasa;
        ejecutarCalculo();
    });

    btnUbicacion.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("La geolocalización no es soportada.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const canton = Calculator.calcularCantonCercano(pos.coords.latitude, pos.coords.longitude);
                selectCanton.value = canton;
                actualizarDistritos();
                ejecutarCalculo();
            },
            () => { alert("No se pudo obtener la ubicación."); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });

    ejecutarCalculo();
});

function setupToggles() {
    const checkAnimales = document.getElementById('checkAnimales');
    const seccionAnimales = document.getElementById('seccionAnimales');
    const lblAnimales = document.getElementById('lblAnimales');

    checkAnimales.addEventListener('change', () => {
        const activo = checkAnimales.checked;
        seccionAnimales.classList.toggle('hidden', !activo);
        lblAnimales.textContent = activo ? "Sí" : "No";
        lblAnimales.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
        ejecutarCalculo();
    });

    const checkCultivo = document.getElementById('checkCultivo');
    const seccionCultivo = document.getElementById('seccionCultivo');
    const lblCultivo = document.getElementById('lblCultivo');

    checkCultivo.addEventListener('change', () => {
        const activo = checkCultivo.checked;
        seccionCultivo.classList.toggle('hidden', !activo);
        lblCultivo.textContent = activo ? "Sí" : "No";
        lblCultivo.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
        ejecutarCalculo();
    });

    const checkAzolla = document.getElementById('checkAzolla');
    const seccionAzolla = document.getElementById('seccionAzolla');
    const lblAzolla = document.getElementById('lblAzolla');

    checkAzolla.addEventListener('change', () => {
        const activo = checkAzolla.checked;
        seccionAzolla.classList.toggle('hidden', !activo);
        lblAzolla.textContent = activo ? "Sí" : "No";
        lblAzolla.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
        ejecutarCalculo();
    });
}

function setupModoTecnico() {
    const checkTecnico = document.getElementById('checkModoTecnico');
    const panelGeo = document.getElementById('panelGeometriaTecnica');
    const panelCap = document.getElementById('panelCaptacionTecnica');

    const inputsTecnicos = ['formaReservorio', 'largoFondo', 'anchoFondo', 'profundidadTotal', 'bordeLibre', 'zonaMuerta', 'taludHV', 'intensidadIDF'];

    checkTecnico.addEventListener('change', () => {
        const activo = checkTecnico.checked;
        panelGeo.classList.toggle('hidden', !activo);
        panelCap.classList.toggle('hidden', !activo);
        ejecutarCalculo();
    });

    inputsTecnicos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', recalcularGeometriaEnPantalla);
    });
}

function recalcularGeometriaEnPantalla() {
    const geo = {
        forma: document.getElementById('formaReservorio').value,
        largoFondo: parseFloat(document.getElementById('largoFondo').value) || 0,
        anchoFondo: parseFloat(document.getElementById('anchoFondo').value) || 0,
        profundidadTotal: parseFloat(document.getElementById('profundidadTotal').value) || 0,
        bordeLibre: parseFloat(document.getElementById('bordeLibre').value) || 0,
        zonaMuerta: parseFloat(document.getElementById('zonaMuerta').value) || 0,
        taludHV: parseFloat(document.getElementById('taludHV').value) || 1.5
    };

    const resGeo = Calculator.calcularVolumenUtilTecnico(geo);

    document.getElementById('lblVolumenUtilM3').textContent = `${resGeo.volumenUtilM3.toLocaleString()} m³`;
    document.getElementById('lblDetalleVolumen').textContent = `Útil = almacenamiento - zona muerta = ${resGeo.volumenUtilLitros.toLocaleString()} L. Profundidad útil efectiva: ${resGeo.hUtil} m.`;

    ejecutarCalculo();
}

function ejecutarCalculo() {
    const modoTecnico = document.getElementById('checkModoTecnico').checked;

    const params = {
        modoTecnico: modoTecnico,
        escenarioClima: document.getElementById('escenarioClima').value,
        areaTecho: parseFloat(document.getElementById('areaTecho').value) || 0,
        materialCoef: parseFloat(document.getElementById('material').value) || 0.9,
        capacidadTanque: parseFloat(document.getElementById('capacidadTanque').value) || 0,

        intensidadIDF: parseFloat(document.getElementById('intensidadIDF').value) || 100,
        primerLavado: modoTecnico ? (parseFloat(document.getElementById('primerLavado').value) || 0) : 0,

        geometria: {
            forma: document.getElementById('formaReservorio').value,
            largoFondo: parseFloat(document.getElementById('largoFondo').value) || 0,
            anchoFondo: parseFloat(document.getElementById('anchoFondo').value) || 0,
            profundidadTotal: parseFloat(document.getElementById('profundidadTotal').value) || 0,
            bordeLibre: parseFloat(document.getElementById('bordeLibre').value) || 0,
            zonaMuerta: parseFloat(document.getElementById('zonaMuerta').value) || 0,
            taludHV: parseFloat(document.getElementById('taludHV').value) || 1.5
        },

        activoAnimales: document.getElementById('checkAnimales').checked,
        tipoGanado: document.getElementById('tipoGanado').value,
        cabezasBovinos: parseFloat(document.getElementById('cabezasBovinos').value) || 0,
        aguaLimpieza: parseFloat(document.getElementById('aguaLimpieza').value) || 0,

        activoCultivo: document.getElementById('checkCultivo').checked,
        tipoCultivo: document.getElementById('tipoCultivo').value,
        etapaFenologica: document.getElementById('etapaFenologica').value,
        areaCultivo: parseFloat(document.getElementById('areaCultivo').value) || 0,
        sistemaRiego: parseFloat(document.getElementById('sistemaRiego').value) || 0.85,

        activoAzolla: document.getElementById('checkAzolla').checked,
        areaAzolla: parseFloat(document.getElementById('areaAzolla').value) || 0,

        rangoAnios: parseInt(document.getElementById('rangoAnios').value) || 1
    };

    const res = Calculator.calcular(params);

    document.getElementById('resCaptacion').textContent = res.captacionAnual.toLocaleString() + " L";
    document.getElementById('resDemandaDiaria').textContent = res.demandaDiariaTotal.toLocaleString() + " L/día";
    document.getElementById('resConfiabilidad').textContent = res.confiabilidad + "%";
    document.getElementById('resAguaDerramada').textContent = res.aguaDerramadaTotal.toLocaleString() + " L";

    document.getElementById('lblCaudalPico').textContent = res.caudalPicoLs + " L/s";

    document.getElementById('detGanado').textContent = res.demandaGanado.toLocaleString() + " L/día";
    document.getElementById('detCultivo').textContent = res.demandaCultivo.toLocaleString() + " L/día";
    document.getElementById('detAzolla').textContent = res.demandaAzolla.toLocaleString() + " L/día";
    document.getElementById('detAreaMax').textContent = res.areaMaxCultivoM2.toLocaleString() + " m²";
    document.getElementById('detTanque').textContent = res.capacidadTanqueL.toLocaleString() + " Litros";

    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');

    if (res.confiabilidad < 70) {
        alertBox.className = "p-3.5 rounded-2xl border bg-rose-50/95 border-rose-300 text-rose-900 shadow-md backdrop-blur-md flex items-center gap-3";
        alertMessage.textContent = "Alerta crítica: La confiabilidad del sistema es baja (" + res.confiabilidad + "%). Riego o bebida en riesgo durante la racha seca.";
    } else if (res.confiabilidad < 90) {
        alertBox.className = "p-3.5 rounded-2xl border bg-amber-50/95 border-amber-300 text-amber-900 shadow-md backdrop-blur-md flex items-center gap-3";
        alertMessage.textContent = "Precaución: Confiabilidad del " + res.confiabilidad + "%. Se sugiere aumentar la captación o el tamaño del reservorio.";
    } else {
        alertBox.className = "p-3.5 rounded-2xl border bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-md backdrop-blur-md flex items-center gap-3";
        alertMessage.textContent = "Excelente balance: Confiabilidad del " + res.confiabilidad + "% para la finca.";
    }

    const tituloGrafico = document.getElementById('tituloGrafico');
    tituloGrafico.innerHTML = `<i data-lucide="line-chart" class="text-emerald-700"></i> Proyección del Tanque (${res.anios} ${res.anios === 1 ? 'Año' : 'Años'}) - ${params.escenarioClima.toUpperCase()}`;
    lucide.createIcons();

    renderGraficoMultilinea(res);
}

function renderGraficoMultilinea(res) {
    const ctx = document.getElementById('chartBalance').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: res.labels,
            datasets: [
                {
                    label: 'Nivel del Tanque (L)',
                    data: res.nivelTanqueSerie,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4
                },
                {
                    label: 'Captación Lluvia (L)',
                    data: res.captacionLluviaSerie,
                    borderColor: '#0284c7',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.2,
                    pointBackgroundColor: '#0284c7',
                    pointRadius: 3
                },
                {
                    label: 'Consumo Finca (L)',
                    data: res.consumoFincaSerie,
                    borderColor: '#f43f5e',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.2,
                    pointBackgroundColor: '#f43f5e',
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 20,
                        font: { size: 11, weight: 'bold' }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                    title: {
                        display: true,
                        text: 'Litros (L)',
                        font: { size: 10, weight: 'bold' }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}