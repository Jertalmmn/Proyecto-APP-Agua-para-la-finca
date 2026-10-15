let chartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    const selectCanton = document.getElementById('canton');
    const selectDistrito = document.getElementById('distrito');
    const btnCalcular = document.getElementById('btnCalcular');
    const btnUbicacion = document.getElementById('btnUbicacion');
    const btnGuardarCaso = document.getElementById('btnGuardarCaso');
    const btnExportarCasos = document.getElementById('btnExportarCasos');

    setupToggles();
    setupModoTecnico();
    renderizarListaCasos();

    function actualizarDistritos() {
        const canton = selectCanton.value;
        const distritos = Calculator.distritosPorCanton[canton] || [];

        selectDistrito.innerHTML = '';
        distritos.forEach(dist => {
            const opt = document.createElement('option');
            const claveLimpia = dist.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');

            opt.value = claveLimpia;
            opt.textContent = dist;
            selectDistrito.appendChild(opt);
        });
        actualizarBadgeConfianza();
    }

    function actualizarBadgeConfianza() {
        const distText = selectDistrito.options[selectDistrito.selectedIndex]?.text || '';
        const badge = document.getElementById('badgeConfianza');
        if (badge) {
            badge.textContent = `IMN / FAO: ${distText}`;
        }
    }

    selectCanton.addEventListener('change', actualizarDistritos);
    selectDistrito.addEventListener('change', actualizarBadgeConfianza);

    actualizarDistritos();

    // BOTÓN CALCULAR BALANCE: ÚNICO DISPARADOR DE LA GRÁFICA Y CÁLCULOS
    btnCalcular.addEventListener('click', ejecutarCalculo);

    document.getElementById('tipoGanado').addEventListener('change', (e) => {
        const tasa = Calculator.tasasGanado[e.target.value] || 50;
        document.getElementById('lblDotacionOficial').textContent = tasa;
    });

    // GESTIÓN DE CASOS GUARDADOS EN LOCALSTORAGE
    btnGuardarCaso.addEventListener('click', () => {
        const nombreFinca = document.getElementById('nombreFinca').value || "Finca sin nombre";
        const params = capturarParametrosActuales();
        
        let casos = JSON.parse(localStorage.getItem('fincas_casos_guardados') || '[]');
        const idx = casos.findIndex(c => c.nombre === nombreFinca);
        const nuevoCaso = { id: Date.now(), nombre: nombreFinca, fecha: new Date().toLocaleDateString('es-CR'), params };
        
        if (idx >= 0) casos[idx] = nuevoCaso;
        else casos.push(nuevoCaso);

        localStorage.setItem('fincas_casos_guardados', JSON.stringify(casos));
        renderizarListaCasos();
        alert(`¡Caso "${nombreFinca}" guardado exitosamente!`);
    });

    btnExportarCasos.addEventListener('click', () => {
        const casos = localStorage.getItem('fincas_casos_guardados') || '[]';
        const blob = new Blob([casos], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Respaldo_Casos_CosechaAgua_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
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
            },
            () => { alert("No se pudo obtener la ubicación GPS."); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });

    // Cálculo inicial al cargar la página
    ejecutarCalculo();
});

function capturarParametrosActuales() {
    return {
        nombreFinca: document.getElementById('nombreFinca').value,
        canton: document.getElementById('canton').value,
        distrito: document.getElementById('distrito').value,
        escenarioClima: document.getElementById('escenarioClima').value,
        areaTecho: document.getElementById('areaTecho').value,
        capacidadTanque: document.getElementById('capacidadTanque').value,
        material: document.getElementById('material').value,
        checkAnimales: document.getElementById('checkAnimales').checked,
        tipoGanado: document.getElementById('tipoGanado').value,
        cabezasBovinos: document.getElementById('cabezasBovinos').value,
        aguaLimpieza: document.getElementById('aguaLimpieza').value,
        checkCultivo: document.getElementById('checkCultivo').checked,
        tipoCultivo: document.getElementById('tipoCultivo').value,
        etapaFenologica: document.getElementById('etapaFenologica').value,
        areaCultivo: document.getElementById('areaCultivo').value,
        sistemaRiego: document.getElementById('sistemaRiego').value,
        checkAzolla: document.getElementById('checkAzolla').checked,
        areaAzolla: document.getElementById('areaAzolla').value,
        laminaAzolla: document.getElementById('laminaAzolla').value,
        fraccionAzolla: document.getElementById('fraccionAzolla').value,
        evaporacionAzolla: document.getElementById('evaporacionAzolla').value,
        infiltracionAzolla: document.getElementById('infiltracionAzolla').value,
        rangoAnios: document.getElementById('rangoAnios').value
    };
}

function cargarCaso(id) {
    const casos = JSON.parse(localStorage.getItem('fincas_casos_guardados') || '[]');
    const caso = casos.find(c => c.id === id);
    if (!caso) return;
    const p = caso.params;

    document.getElementById('nombreFinca').value = p.nombreFinca || "";
    document.getElementById('canton').value = p.canton || "nicoya";
    document.getElementById('canton').dispatchEvent(new Event('change'));
    document.getElementById('distrito').value = p.distrito || "";
    document.getElementById('escenarioClima').value = p.escenarioClima || "tipico";
    document.getElementById('areaTecho').value = p.areaTecho || 150;
    document.getElementById('capacidadTanque').value = p.capacidadTanque || 10;
    document.getElementById('material').value = p.material || "0.90";
    
    document.getElementById('checkAnimales').checked = p.checkAnimales ?? true;
    document.getElementById('checkAnimales').dispatchEvent(new Event('change'));
    document.getElementById('tipoGanado').value = p.tipoGanado || "bovino_carne";
    document.getElementById('cabezasBovinos').value = p.cabezasBovinos || 10;
    document.getElementById('aguaLimpieza').value = p.aguaLimpieza || 50;
    
    document.getElementById('checkCultivo').checked = p.checkCultivo ?? true;
    document.getElementById('checkCultivo').dispatchEvent(new Event('change'));
    document.getElementById('tipoCultivo').value = p.tipoCultivo || "pasto";
    document.getElementById('etapaFenologica').value = p.etapaFenologica || "media";
    document.getElementById('areaCultivo').value = p.areaCultivo || 1000;
    document.getElementById('sistemaRiego').value = p.sistemaRiego || "0.85";
    
    document.getElementById('checkAzolla').checked = p.checkAzolla ?? false;
    document.getElementById('checkAzolla').dispatchEvent(new Event('change'));
    document.getElementById('areaAzolla').value = p.areaAzolla || 10;
    document.getElementById('laminaAzolla').value = p.laminaAzolla || 0.15;
    document.getElementById('fraccionAzolla').value = p.fraccionAzolla || 1;
    document.getElementById('evaporacionAzolla').value = p.evaporacionAzolla || 6;
    document.getElementById('infiltracionAzolla').value = p.infiltracionAzolla || 0;

    document.getElementById('rangoAnios').value = p.rangoAnios || 1;

    ejecutarCalculo();
}

function eliminarCaso(id, event) {
    event.stopPropagation();
    if (!confirm("¿Desea eliminar este caso guardado?")) return;
    let casos = JSON.parse(localStorage.getItem('fincas_casos_guardados') || '[]');
    casos = casos.filter(c => c.id !== id);
    localStorage.setItem('fincas_casos_guardados', JSON.stringify(casos));
    renderizarListaCasos();
}

function renderizarListaCasos() {
    const container = document.getElementById('listaCasosContainer');
    const casos = JSON.parse(localStorage.getItem('fincas_casos_guardados') || '[]');

    if (casos.length === 0) {
        container.innerHTML = `<div class="p-3 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-400">No hay casos guardados aún.</div>`;
        return;
    }

    container.innerHTML = '';
    casos.forEach(c => {
        const item = document.createElement('div');
        item.className = "p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 cursor-pointer transition-all flex items-center justify-between group shadow-sm";
        item.onclick = () => cargarCaso(c.id);
        item.innerHTML = `
            <div>
                <h4 class="text-xs font-bold text-slate-800 group-hover:text-emerald-700">${c.nombre}</h4>
                <span class="text-[9px] text-slate-400">${c.fecha}</span>
            </div>
            <button onclick="eliminarCaso(${c.id}, event)" class="text-slate-400 hover:text-rose-600 p-1" title="Eliminar">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

function setupToggles() {
    const checkAnimales = document.getElementById('checkAnimales');
    const seccionAnimales = document.getElementById('seccionAnimales');
    const lblAnimales = document.getElementById('lblAnimales');

    checkAnimales.addEventListener('change', () => {
        const activo = checkAnimales.checked;
        seccionAnimales.classList.toggle('hidden', !activo);
        lblAnimales.textContent = activo ? "Sí" : "No";
        lblAnimales.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
    });

    const checkCultivo = document.getElementById('checkCultivo');
    const seccionCultivo = document.getElementById('seccionCultivo');
    const lblCultivo = document.getElementById('lblCultivo');

    checkCultivo.addEventListener('change', () => {
        const activo = checkCultivo.checked;
        seccionCultivo.classList.toggle('hidden', !activo);
        lblCultivo.textContent = activo ? "Sí" : "No";
        lblCultivo.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
    });

    const checkAzolla = document.getElementById('checkAzolla');
    const seccionAzolla = document.getElementById('seccionAzolla');

    checkAzolla.addEventListener('change', () => {
        seccionAzolla.classList.toggle('hidden', !checkAzolla.checked);
    });
}

function setupModoTecnico() {
    const checkTecnico = document.getElementById('checkModoTecnico');
    const panelGeo = document.getElementById('panelGeometriaTecnica');
    const panelCap = document.getElementById('panelCaptacionTecnica');

    const inputsTecnicos = ['formaReservorio', 'largoFondo', 'anchoFondo', 'profundidadTotal', 'bordeLibre', 'zonaMuerta', 'taludHV', 'intensidadIDF', 'primerLavado'];

    checkTecnico.addEventListener('change', () => {
        const activo = checkTecnico.checked;
        panelGeo.classList.toggle('hidden', !activo);
        panelCap.classList.toggle('hidden', !activo);
        if (activo) recalcularGeometriaEnPantalla();
    });

    inputsTecnicos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            if (document.getElementById('checkModoTecnico').checked) {
                recalcularGeometriaEnPantalla();
            }
        });
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
}

function ejecutarCalculo() {
    const modoTecnico = document.getElementById('checkModoTecnico').checked;

    const params = {
        modoTecnico: modoTecnico,
        canton: document.getElementById('canton').value,
        distrito: document.getElementById('distrito').value,
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

        azolla: {
            activo: document.getElementById('checkAzolla').checked,
            area: parseFloat(document.getElementById('areaAzolla').value) || 0,
            lamina: parseFloat(document.getElementById('laminaAzolla').value) || 0.15,
            fraccionInicio: parseFloat(document.getElementById('fraccionAzolla').value) || 1,
            evaporacion: parseFloat(document.getElementById('evaporacionAzolla').value) || 6,
            infiltracion: parseFloat(document.getElementById('infiltracionAzolla').value) || 0
        },

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

async function generarInformePDF() {
    if (!window.jspdf) {
        alert("El módulo de PDF aún se está cargando, reintenta en un momento...");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const nombreFinca = document.getElementById('nombreFinca')?.value || "Finca";
    const selectCanton = document.getElementById('canton');
    const selectDistrito = document.getElementById('distrito');

    const cantonText = selectCanton.options[selectCanton.selectedIndex]?.text || "N/A";
    const distritoText = selectDistrito.options[selectDistrito.selectedIndex]?.text || "N/A";

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE TÉCNICO DE BALANCE HÍDRICO (IMN / FAO)", 14, 16);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CR')}`, 14, 33);
    doc.text(`Finca: ${nombreFinca}`, 14, 39);
    doc.text(`Ubicación: Cantón de ${cantonText}, Distrito de ${distritoText}`, 14, 45);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, 52, 182, 22, 3, 3, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CAPTACIÓN ANUAL ESTIMADA:", 18, 60);
    doc.setFontSize(13);
    doc.text(document.getElementById('resCaptacion')?.innerText || "0 L", 18, 68);

    doc.setFontSize(10);
    doc.text("CONFIABILIDAD DEL SISTEMA:", 110, 60);
    doc.setFontSize(13);
    doc.text(document.getElementById('resConfiabilidad')?.innerText || "0%", 110, 68);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle del Balance e Indicadores", 14, 83);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`• Bebida Animal + Limpieza: ${document.getElementById('detGanado')?.innerText || '0 L/día'}`, 18, 91);
    doc.text(`• Riego de Cultivo (Ajuste FAO-56): ${document.getElementById('detCultivo')?.innerText || '0 L/día'}`, 18, 97);
    doc.text(`• Demanda Estanque Azolla: ${document.getElementById('detAzolla')?.innerText || '0 L/día'}`, 18, 103);
    doc.text(`• Área Máxima de Cultivo Abastecible: ${document.getElementById('detAreaMax')?.innerText || '0 m²'}`, 18, 109);
    doc.text(`• Capacidad Total del Tanque: ${document.getElementById('detTanque')?.innerText || '0 Litros'}`, 18, 115);

    const canvas = document.getElementById("chartBalance");
    if (canvas) {
        const img = canvas.toDataURL("image/png");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Proyección del Tanque (Balance Mensual)", 14, 126);
        doc.addImage(img, "PNG", 14, 130, 182, 85);
    }

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Generado por Cosecha de Agua Guanacaste - Universidad Nacional de Costa Rica (CEMEDE)", 14, 285);

    doc.save(`Informe_Agua_${nombreFinca}_${cantonText}.pdf`);
}