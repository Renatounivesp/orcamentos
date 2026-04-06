document.addEventListener('DOMContentLoaded', () => {
    // Lógica do Alternador de Tema
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('resaut_theme') || 'dark';
    const themeIcon = themeToggle ? themeToggle.querySelector('i') : null;

    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) themeIcon.className = 'fas fa-sun';
    } else {
        if (themeIcon) themeIcon.className = 'fas fa-moon';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            const theme = isLight ? 'light' : 'dark';
            localStorage.setItem('resaut_theme', theme);

            if (themeIcon) {
                themeIcon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
            }
        });
    }



    const servicesList = document.getElementById('services-list');
    const addServiceBtn = document.getElementById('add-service');
    const generatePdfBtn = document.getElementById('generate-pdf');
    const form = document.getElementById('orcamento-form');

    // Modal & Config Elements
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings');
    const closeModalBtn = document.querySelector('.close-modal');
    const saveSettingsBtn = document.getElementById('save-settings');

    // Novos BotÃµes e Elementos
    const btnNovo = document.getElementById('btn-novo');
    const historyModal = document.getElementById('history-modal');
    const closeHistoryBtn = document.getElementById('close-history');
    const historyList = document.getElementById('history-list');
    const syncIndicator = document.getElementById('sync-indicator');
    const orcamentoStatus = document.getElementById('orcamento-status');

    // --- SUPABASE CONFIG ---
    // Substitua estas informações após criar seu projeto no Supabase
    const SUPABASE_URL = 'https://SUA_URL_AQUI.supabase.co';
    const SUPABASE_KEY = 'SUA_CHAVE_API_AQUI';
    let supabase = null;

    if (SUPABASE_URL !== 'https://SUA_URL_AQUI.supabase.co') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    function updateSyncIndicator(online) {
        if (!syncIndicator) return;
        if (online && supabase) {
            syncIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Sincronizado';
            syncIndicator.classList.remove('offline');
        } else {
            syncIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Local (Offline)';
            syncIndicator.classList.add('offline');
        }
    }
    updateSyncIndicator(false);

    // Default Data
    const defaultData = {
        name: "RESAUT",
        tagline: "Est\u00e9tica Automotiva | Funilaria e Pintura",
        phone: "(11) 94752-9171",
        insta: "@resautesteticaautomotiva",
        cnpj: "11.655.200/0001-07",
        addr: "Rua Francisco Polito, 16 - Vila Prudente, SP",
        logo: "logo_resaut.png"
    };

    let companyData = JSON.parse(localStorage.getItem('resaut_company')) || defaultData;

    // Auto-correção para forçar o uso do novo logo .png transparente
    // Se o logo salvo for uma string Base64 antiga, resetamos para o arquivo novo
    if (companyData.logo && companyData.logo.startsWith('data:image')) {
        companyData.logo = "logo_resaut.png";
        localStorage.setItem('resaut_company', JSON.stringify(companyData));
    }

    // Auto-correção de encoding para usuários com dados antigos salvos
    if (companyData.tagline.includes('Est\u00c3\u00a9tica')) {
        companyData.tagline = companyData.tagline.replace('Est\u00c3\u00a9tica', 'Est\u00e9tica');
    }
    // Caso o usuÃ¡rio tenha editado e salvado com erro
    if (companyData.tagline === "EstÃ©tica Automotiva | Funilaria e Pintura") {
        companyData.tagline = "Est\u00e9tica Automotiva | Funilaria e Pintura";
    }

    // History management
    function getHistory() {
        return JSON.parse(localStorage.getItem('resaut_history')) || [];
    }

    function saveToHistory() {
        const clienteNome = document.getElementById('cliente-nome').value;
        if (!clienteNome) return;

        const services = [];
        document.querySelectorAll('.service-item').forEach(item => {
            const name = item.querySelector('.srv-name').value;
            const val = item.querySelector('.srv-val').value;
            if (name) services.push({ name, val, desc: item.querySelector('.srv-desc').value });
        });

        const entry = {
            id: Date.now(),
            date: new Date().toLocaleString('pt-br'),
            cliente: clienteNome,
            veiculo: document.getElementById('veiculo-modelo').value,
            total: document.getElementById('total-val').innerText,
            status: orcamentoStatus.value,
            data: {
                cliente: clienteNome,
                tel: document.getElementById('cliente-tel').value,
                data: document.getElementById('orcamento-data').value,
                veiculo: {
                    modelo: document.getElementById('veiculo-modelo').value,
                    placa: document.getElementById('veiculo-placa').value,
                    cor: document.getElementById('veiculo-cor').value
                },
                services: services,
                desconto: document.getElementById('desconto-val').value,
                obs: document.getElementById('observacoes').value,
                status: orcamentoStatus.value
            }
        };

        // Salvar Localmente
        const history = getHistory();
        history.unshift(entry);
        if (history.length > 50) history.pop();
        localStorage.setItem('resaut_history', JSON.stringify(history));

        // Tentar Salvar na Nuvem (Supabase)
        syncToCloud(entry);
    }

    async function syncToCloud(entry) {
        if (!supabase) return;
        try {
            const { error } = await supabase.from('orcamentos').upsert({
                id_local: entry.id,
                cliente: entry.cliente,
                veiculo: entry.veiculo,
                total: entry.total,
                status: entry.status,
                detalhes: entry.data,
                updated_at: new Date()
            });
            if (!error) updateSyncIndicator(true);
        } catch (e) {
            console.error("Erro ao sincronizar:", e);
            updateSyncIndicator(false);
        }
    }

    async function fetchFromCloud() {
        if (!supabase) return;
        try {
            const { data, error } = await supabase.from('orcamentos').select('*').order('created_at', { ascending: false }).limit(50);
            if (error) throw error;
            
            if (data && data.length > 0) {
                // Converter de volta para o formato local
                const cloudHistory = data.map(item => ({
                    id: item.id_local,
                    date: new Date(item.created_at).toLocaleString('pt-br'),
                    cliente: item.cliente,
                    veiculo: item.veiculo,
                    total: item.total,
                    status: item.status,
                    data: item.detalhes
                }));
                localStorage.setItem('resaut_history', JSON.stringify(cloudHistory));
                updateSyncIndicator(true);
                return cloudHistory;
            }
        } catch (e) {
            console.error("Erro ao buscar da nuvem:", e);
            updateSyncIndicator(false);
        }
        return getHistory();
    }

    async function renderHistory() {
        const history = await fetchFromCloud(); // Tenta buscar da nuvem primeiro
        if (!history || history.length === 0) {
            historyList.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">Nenhum orçamento salvo ainda.</p>';
            return;
        }

        historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <div class="history-info">
                    <h4>${item.cliente}</h4>
                    <p>${item.date} - ${item.veiculo || 'Sem veículo'}</p>
                    <strong>${item.total}</strong>
                    <div class="badge badge-${(item.status || 'Pendente').toLowerCase()}">${item.status || 'Pendente'}</div>
                </div>
                <div class="history-actions">
                    <button class="btn-load" onclick="window.loadBudget(${item.id})">Carregar</button>
                    <button class="btn-del" onclick="window.deleteBudget(${item.id})">Excluir</button>
                </div>
            </div>
        `).join('');
    }

    window.loadBudget = (id) => {
        const history = getHistory();
        const item = history.find(h => h.id === id);
        if (!item) return;

        if (confirm(`Deseja carregar o orçamento de ${item.cliente}? O rascunho atual será perdido.`)) {
            const draft = item.data;
            document.getElementById('cliente-nome').value = draft.cliente || '';
            document.getElementById('cliente-tel').value = draft.tel || '';
            document.getElementById('orcamento-data').value = draft.data || '';
            document.getElementById('veiculo-modelo').value = draft.veiculo?.modelo || '';
            document.getElementById('veiculo-placa').value = draft.veiculo?.placa || '';
            document.getElementById('veiculo-cor').value = draft.veiculo?.cor || '';
            document.getElementById('desconto-val').value = draft.desconto || 0;
            document.getElementById('observacoes').value = draft.obs || '';
            if (draft.status) orcamentoStatus.value = draft.status;

            // Limpa e repovoa serviços
            const container = document.getElementById('services-list');
            container.innerHTML = '';
            if (draft.services?.length > 0) {
                draft.services.forEach(s => addServiceRow(s.name, s.desc, s.val));
            } else {
                addServiceRow();
            }
            updateTotals();
            saveDraft();
            historyModal.style.display = 'none';
        }
    };

    window.deleteBudget = async (id) => {
        if (confirm('Tem certeza que deseja excluir este orçamento?')) {
            // Local
            const history = getHistory().filter(h => h.id !== id);
            localStorage.setItem('resaut_history', JSON.stringify(history));
            
            // Cloud
            if (supabase) {
                await supabase.from('orcamentos').delete().eq('id_local', id);
            }
            
            renderHistory();
        }
    };

    function resetForm() {
        if (confirm('Deseja realmente limpar todo o formulário para um NOVO orçamento?')) {
            document.getElementById('cliente-nome').value = '';
            document.getElementById('cliente-tel').value = '';
            document.getElementById('veiculo-modelo').value = '';
            document.getElementById('veiculo-placa').value = '';
            document.getElementById('veiculo-cor').value = '';
            document.getElementById('desconto-val').value = 0;
            document.getElementById('observacoes').value = '';
            document.getElementById('orcamento-data').valueAsDate = new Date();

            const container = document.getElementById('services-list');
            container.innerHTML = '';
            addServiceRow();
            updateTotals();
            orcamentoStatus.value = "Pendente";
            localStorage.removeItem('resaut_draft');
        }
    }

    // Modal Events
    btnHistorico.addEventListener('click', () => {
        renderHistory();
        historyModal.style.display = 'block';
    });

    closeHistoryBtn.addEventListener('click', () => historyModal.style.display = 'none');
    btnNovo.addEventListener('click', resetForm);

    // Close modal on click outside
    window.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.style.display = 'none';
        if (e.target === document.getElementById('settings-modal')) document.getElementById('settings-modal').style.display = 'none';
    });

    // Load Initial States
    applyCompanyData();
    loadDraft();

    // --- MODAL LOGIC ---
    openSettingsBtn.onclick = () => {
        document.getElementById('config-name').value = companyData.name;
        document.getElementById('config-tagline').value = companyData.tagline;
        document.getElementById('config-phone').value = companyData.phone;
        document.getElementById('config-insta').value = companyData.insta;
        document.getElementById('config-cnpj').value = companyData.cnpj;
        document.getElementById('config-addr').value = companyData.addr;
        settingsModal.style.display = 'block';
    };

    closeModalBtn.onclick = () => settingsModal.style.display = 'none';
    window.onclick = (e) => { if (e.target == settingsModal) settingsModal.style.display = 'none'; };

    saveSettingsBtn.onclick = () => {
        companyData.name = document.getElementById('config-name').value;
        companyData.tagline = document.getElementById('config-tagline').value;
        companyData.phone = document.getElementById('config-phone').value;
        companyData.insta = document.getElementById('config-insta').value;
        companyData.cnpj = document.getElementById('config-cnpj').value;
        companyData.addr = document.getElementById('config-addr').value;

        const logoInput = document.getElementById('config-logo-input');
        if (logoInput.files && logoInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                companyData.logo = e.target.result;
                finishSaving();
            };
            reader.readAsDataURL(logoInput.files[0]);
        } else {
            finishSaving();
        }
    };

    function finishSaving() {
        localStorage.setItem('resaut_company', JSON.stringify(companyData));
        applyCompanyData();
        settingsModal.style.display = 'none';
        alert('Configurações salvas com sucesso!');
    }

    function applyCompanyData() {
        // UI Dashboard
        document.getElementById('display-company-name').innerText = companyData.name;
        document.getElementById('display-company-tagline').innerText = companyData.tagline;
        document.getElementById('display-company-phone').innerText = companyData.phone;
        document.getElementById('display-company-insta').innerText = companyData.insta;
        document.getElementById('display-company-cnpj').innerText = companyData.cnpj;
        document.getElementById('header-logo-img').src = companyData.logo;

        // PDF Template
        document.getElementById('pdf-company-name').innerText = companyData.name;
        document.getElementById('pdf-company-tagline').innerText = companyData.tagline;
        document.getElementById('pdf-company-cnpj').innerText = `CNPJ: ${companyData.cnpj}`;
        document.getElementById('pdf-company-addr').innerText = companyData.addr;
        document.getElementById('pdf-company-contact').innerText = `Tel: ${companyData.phone} | Instagram: ${companyData.insta}`;
        document.querySelector('.pdf-logo').src = companyData.logo;
    }

    // --- FORM LOGIC ---
    addServiceBtn.addEventListener('click', () => addServiceRow());

    function addServiceRow(name = '', desc = '', val = 0) {
        const div = document.createElement('div');
        div.className = 'service-item';
        div.innerHTML = `
            <button type="button" class="remove-btn">Remover</button>
            <div class="input-group">
                <label>Nome do Serviço</label>
                <input type="text" class="srv-name" placeholder="Ex: Polimento" value="${name}" required>
            </div>
            <div class="grid-2">
                <div class="input-group">
                    <label>Descrição</label>
                    <input type="text" class="srv-desc" placeholder="Detalhes..." value="${desc}">
                </div>
                <div class="input-group">
                    <label>Valor (R$)</label>
                    <input type="number" class="srv-val" step="0.01" value="${val}" required>
                </div>
            </div>
        `;

        servicesList.appendChild(div);

        div.querySelector('.remove-btn').onclick = () => { div.remove(); updateTotals(); saveDraft(); };
        div.querySelectorAll('input').forEach(input => {
            input.oninput = () => { updateTotals(); saveDraft(); };
        });
        updateTotals();
    }

    function updateTotals() {
        let subtotal = 0;
        document.querySelectorAll('.srv-val').forEach(input => {
            subtotal += parseFloat(input.value) || 0;
        });

        const desconto = parseFloat(document.getElementById('desconto-val').value) || 0;
        const total = subtotal - desconto;

        document.getElementById('subtotal-val').innerText = formatCurrency(subtotal);
        document.getElementById('total-val').innerText = formatCurrency(total);

        document.getElementById('pdf-subtotal').innerText = formatCurrency(subtotal);
        document.getElementById('pdf-desconto').innerText = formatCurrency(desconto);
        document.getElementById('pdf-total').innerText = formatCurrency(total);
    }

    function formatCurrency(val) { return val.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' }); }

    document.getElementById('desconto-val').oninput = updateTotals;

    function saveDraft() {
        const services = [];
        document.querySelectorAll('.service-item').forEach(item => {
            services.push({
                name: item.querySelector('.srv-name').value,
                desc: item.querySelector('.srv-desc').value,
                val: item.querySelector('.srv-val').value
            });
        });

        const draft = {
            cliente: document.getElementById('cliente-nome').value,
            tel: document.getElementById('cliente-tel').value,
            data: document.getElementById('orcamento-data').value,
            veiculo: {
                modelo: document.getElementById('veiculo-modelo').value,
                placa: document.getElementById('veiculo-placa').value,
                cor: document.getElementById('veiculo-cor').value
            },
            services: services,
            desconto: document.getElementById('desconto-val').value,
            obs: document.getElementById('observacoes').value,
            status: orcamentoStatus.value
        };
        localStorage.setItem('resaut_draft', JSON.stringify(draft));
    }

    function loadDraft() {
        const saved = localStorage.getItem('resaut_draft');
        if (!saved) { addServiceRow(); document.getElementById('orcamento-data').valueAsDate = new Date(); return; }

        const draft = JSON.parse(saved);
        document.getElementById('cliente-nome').value = draft.cliente || '';
        document.getElementById('cliente-tel').value = draft.tel || '';
        document.getElementById('orcamento-data').value = draft.data || '';
        document.getElementById('veiculo-modelo').value = draft.veiculo?.modelo || '';
        document.getElementById('veiculo-placa').value = draft.veiculo?.placa || '';
        document.getElementById('veiculo-cor').value = draft.veiculo?.cor || '';
        document.getElementById('desconto-val').value = draft.desconto || 0;
        document.getElementById('observacoes').value = draft.obs || '';
        if (draft.status) orcamentoStatus.value = draft.status;

        if (draft.services?.length > 0) draft.services.forEach(s => addServiceRow(s.name, s.desc, s.val));
        else addServiceRow();
        updateTotals();
    }

    generatePdfBtn.addEventListener('click', () => {
        console.log("Iniciando geração de PDF...");

        // Verifica se a biblioteca foi carregada
        if (typeof html2pdf === 'undefined') {
            alert('Aguardando carregamento da biblioteca de PDF... Verifique se vocÃª estÃ¡ conectado Ã  internet.');
            return;
        }

        // Validação básica
        const clienteNome = document.getElementById('cliente-nome').value;
        if (!clienteNome) {
            alert('Por favor, preencha o NOME DO CLIENTE antes de gerar o PDF.');
            return;
        }

        try {
            // Fill PDF Template
            document.getElementById('pdf-cliente').innerText = clienteNome.toUpperCase();
            document.getElementById('pdf-tel').innerText = document.getElementById('cliente-tel').value;

            const dataVal = document.getElementById('orcamento-data').value;
            document.getElementById('pdf-data').innerText = dataVal ? dataVal.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-br');

            const veiculo = `${document.getElementById('veiculo-modelo').value} - ${document.getElementById('veiculo-placa').value} (${document.getElementById('veiculo-cor').value})`.toUpperCase();
            document.getElementById('pdf-veiculo').innerText = veiculo;

            const tableBody = document.getElementById('pdf-services-body');
            tableBody.innerHTML = '';

            let temServico = false;
            document.querySelectorAll('.service-item').forEach(item => {
                const name = item.querySelector('.srv-name').value;
                const desc = item.querySelector('.srv-desc').value;
                const val = parseFloat(item.querySelector('.srv-val').value) || 0;

                if (name) {
                    temServico = true;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><strong>${name}</strong></td>
                        <td style="color: #666;">${desc}</td>
                        <td class="align-right">${formatCurrency(val)}</td>
                    `;
                    tableBody.appendChild(tr);
                }
            });

            if (!temServico) {
                alert('Adicione pelo menos um serviço antes de gerar o PDF.');
                return;
            }

            document.getElementById('pdf-notes-text').innerText = document.getElementById('observacoes').value;

            // Opções do PDF
            const element = document.getElementById('pdf-content');
            const fileName = `orcamento_${clienteNome.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;

            const opt = {
                margin: 0,
                filename: fileName,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    letterRendering: true,
                    logging: false,
                    scrollX: 0,
                    scrollY: 0
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // UI Feedback
            generatePdfBtn.innerText = "Gerando PDF...";
            generatePdfBtn.disabled = true;

            // Prepara visibilidade para captura
            window.scrollTo(0, 0);
            const preview = document.getElementById('preview-container');
            preview.style.visibility = 'visible';
            preview.style.height = 'auto';
            preview.style.position = 'fixed';
            preview.style.top = '0';
            preview.style.left = '0';
            preview.style.zIndex = '-9999';

            console.log("Chamando html2pdf...");
            setTimeout(() => {
                html2pdf().set(opt).from(element).save().then(() => {
                    console.log("PDF gerado com sucesso!");
                    saveToHistory(); // SALVAR NO HISTORICO APOS GERAR
                    generatePdfBtn.innerText = "Gerar PDF Profissional";
                    generatePdfBtn.disabled = false;

                    // Restaura estado escondido
                    preview.style.visibility = 'hidden';
                    preview.style.height = '0';
                }).catch(err => {
                    console.error("Erro no html2pdf:", err);
                    alert("Erro ao gerar o PDF: " + err.message);
                    generatePdfBtn.innerText = "Gerar PDF Profissional";
                    generatePdfBtn.disabled = false;
                });
            }, 1000);

        } catch (error) {
            console.error("Erro geral na função:", error);
            alert("Ocorreu um erro inesperado: " + error.message);
            generatePdfBtn.innerText = "Gerar PDF Profissional";
            generatePdfBtn.disabled = false;
        }
    });

    form.addEventListener('input', () => saveDraft());
});

