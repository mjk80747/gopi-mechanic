        // Permanent Storage Key
        const DB_KEY = 'suresh_bike_mechanics_records_v1';

        // Load permanently stored records safely
        function loadPermanentRecords() {
            try {
                const data = localStorage.getItem(DB_KEY);
                if (data !== null) {
                    return JSON.parse(data);
                }
            } catch (e) {
                console.error("Storage load error:", e);
            }

            // Initial starter demo records saved immediately to permanent storage
            const defaults = [
                {
                    id: '1',
                    bikeNumber: 'AP39 AB 1234',
                    customerName: 'Ramesh Kumar',
                    customerPhone: '9876543210',
                    bikeModel: 'Hero Splendor Plus',
                    amount: 550,
                    advanceAmount: 550,
                    paymentStatus: 'Paid',
                    workDesc: 'Oil change and chain tightening',
                    date: new Date().toLocaleDateString('en-IN')
                },
                {
                    id: '2',
                    bikeNumber: 'TS09 EF 5678',
                    customerName: 'Suresh Reddy',
                    customerPhone: '9123456780',
                    bikeModel: 'Bajaj Pulsar 150',
                    amount: 450,
                    advanceAmount: 200,
                    paymentStatus: 'Pending',
                    workDesc: 'Rear brake shoe & wash',
                    date: new Date().toLocaleDateString('en-IN')
                }
            ];

            try {
                localStorage.setItem(DB_KEY, JSON.stringify(defaults));
            } catch (e) {}

            return defaults;
        }

        let records = loadPermanentRecords();

        // Dual-Storage: IndexedDB initialization for permanent browser database backup
        let dbInstance = null;
        if (window.indexedDB) {
            const dbReq = window.indexedDB.open('SureshBikeMechanicsDB', 1);
            dbReq.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('bike_jobs')) {
                    db.createObjectStore('bike_jobs', { keyPath: 'id' });
                }
            };
            dbReq.onsuccess = (e) => {
                dbInstance = e.target.result;
                // If localStorage was cleared by phone cache cleaner, recover from IndexedDB
                if (!records || records.length === 0) {
                    recoverFromIndexedDB();
                } else {
                    saveToIndexedDB(records);
                }
            };
        }

        function saveToIndexedDB(data) {
            if (!dbInstance) return;
            try {
                const tx = dbInstance.transaction('bike_jobs', 'readwrite');
                const store = tx.objectStore('bike_jobs');
                store.clear();
                data.forEach(item => store.put(item));
            } catch (err) {
                console.warn("IndexedDB write failed:", err);
            }
        }

        function recoverFromIndexedDB() {
            if (!dbInstance) return;
            try {
                const tx = dbInstance.transaction('bike_jobs', 'readonly');
                const store = tx.objectStore('bike_jobs');
                const getAll = store.getAll();
                getAll.onsuccess = () => {
                    if (getAll.result && getAll.result.length > 0) {
                        records = getAll.result;
                        localStorage.setItem(DB_KEY, JSON.stringify(records));
                        renderMobileCards();
                        updateMobileStats();
                    }
                };
            } catch (err) {}
        }

        window.addEventListener('DOMContentLoaded', () => {
            renderMobileCards();
            updateMobileStats();
            initTheme();
        });

        // 1. Switch Between 2 Primary Mobile Buttons
        function switchMobileTab(tab) {
            const btn1 = document.getElementById('tabButton1');
            const btn2 = document.getElementById('tabButton2');
            const screenForm = document.getElementById('screenForm');
            const screenRecords = document.getElementById('screenRecords');

            if (tab === 'form') {
                btn1.classList.add('active');
                btn2.classList.remove('active');
                screenForm.classList.add('active');
                screenRecords.classList.remove('active');
            } else {
                btn2.classList.add('active');
                btn1.classList.remove('active');
                screenRecords.classList.add('active');
                screenForm.classList.remove('active');
                renderMobileCards();
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // 2. Select Payment Segment (Paid / Pending)
        function pickPayment(val) {
            document.getElementById('mPaymentStatus').value = val;
            const paidBtn = document.getElementById('btnPaidSeg');
            const pendingBtn = document.getElementById('btnPendingSeg');

            if (val === 'Paid') {
                paidBtn.className = 'segment-btn active-paid';
                pendingBtn.className = 'segment-btn';
            } else {
                paidBtn.className = 'segment-btn';
                pendingBtn.className = 'segment-btn active-pending';
            }
        }

        // 3. Save or Update Entry (Permanently saved)
        function saveMobileEntry(e) {
            e.preventDefault();

            const recordId = document.getElementById('entryRecordId').value;
            const bikeNumber = document.getElementById('mBikeNo').value.trim().toUpperCase();
            const customerName = document.getElementById('mCustName').value.trim();
            const customerPhone = document.getElementById('mCustPhone').value.trim();
            const bikeModel = document.getElementById('mBikeModel').value.trim();
            const amount = parseFloat(document.getElementById('mAmount').value) || 0;
            const advanceAmount = parseFloat(document.getElementById('mAdvance').value) || 0;
            let paymentStatus = document.getElementById('mPaymentStatus').value;
            const workDesc = document.getElementById('mWorkDesc').value.trim();

            // Auto-check if advance covers entire bill
            if (advanceAmount >= amount && amount > 0) {
                paymentStatus = 'Paid';
            }

            if (recordId) {
                // Update Existing
                const idx = records.findIndex(r => r.id === recordId);
                if (idx !== -1) {
                    records[idx] = {
                        ...records[idx],
                        bikeNumber,
                        customerName,
                        customerPhone,
                        bikeModel,
                        amount,
                        advanceAmount,
                        paymentStatus,
                        workDesc
                    };
                    showToast('✅ Details & Advance Updated');
                }
            } else {
                // Add New
                const newRecord = {
                    id: 'bike_' + Date.now().toString(),
                    bikeNumber,
                    customerName,
                    customerPhone,
                    bikeModel,
                    amount,
                    advanceAmount,
                    paymentStatus,
                    workDesc,
                    date: new Date().toLocaleDateString('en-IN')
                };
                records.unshift(newRecord);
                showToast('🎉 New Bike Entry Saved');
            }

            // Write permanently to storage
            saveToStorage();
            cancelMobileEdit();
            updateMobileStats();

            // Automatically switch to view details
            switchMobileTab('records');
        }

        // Live Balance Calculation in Form
        function calcFormBalance() {
            const total = parseFloat(document.getElementById('mAmount').value) || 0;
            const adv = parseFloat(document.getElementById('mAdvance').value) || 0;
            const display = document.getElementById('mBalanceDisplay');

            if (total > 0 || adv > 0) {
                const balance = Math.max(0, total - adv);
                display.style.display = 'block';
                if (adv >= total && total > 0) {
                    display.innerHTML = `<strong>✓ Full Paid (Balance: ₹0)</strong>`;
                    pickPayment('Paid');
                } else if (adv > 0) {
                    display.innerHTML = `Advance: ₹${adv} &nbsp;|&nbsp; <strong>Balance Due: ₹${balance}</strong>`;
                } else {
                    display.innerHTML = `<strong>Balance Due: ₹${balance}</strong>`;
                }
            } else {
                display.style.display = 'none';
            }
        }

        // 4. Edit Entry (Loads form and activates Tab 1)
        function editMobileRecord(id) {
            const r = records.find(item => item.id === id);
            if (!r) return;

            document.getElementById('entryRecordId').value = r.id;
            document.getElementById('mBikeNo').value = r.bikeNumber;
            document.getElementById('mCustName').value = r.customerName;
            document.getElementById('mCustPhone').value = r.customerPhone;
            document.getElementById('mBikeModel').value = r.bikeModel || '';
            document.getElementById('mAmount').value = r.amount || '';
            document.getElementById('mAdvance').value = r.advanceAmount !== undefined ? r.advanceAmount : '';
            document.getElementById('mWorkDesc').value = r.workDesc || '';
            
            calcFormBalance();
            pickPayment(r.paymentStatus);

            document.getElementById('formTitle').innerText = 'Update Details';
            document.getElementById('btnSubmitMobile').innerHTML = '⚡ Update Customer Details';
            document.getElementById('btnCancelEditMobile').classList.remove('hidden');
            document.getElementById('editIndicator').classList.remove('hidden');

            switchMobileTab('form');
        }

        // 5. Cancel Editing
        function cancelMobileEdit() {
            document.getElementById('mobileBikeForm').reset();
            document.getElementById('entryRecordId').value = '';
            document.getElementById('formTitle').innerText = 'Enter Bike Details';
            document.getElementById('btnSubmitMobile').innerHTML = '💾 Save Details';
            document.getElementById('btnCancelEditMobile').classList.add('hidden');
            document.getElementById('editIndicator').classList.add('hidden');
            document.getElementById('mBalanceDisplay').style.display = 'none';
            pickPayment('Paid');
        }

        // 6. Delete Entry (ONLY way to remove a detail)
        function deleteMobileRecord(id) {
            const item = records.find(r => r.id === id);
            const bike = item ? item.bikeNumber : 'this record';
            if (confirm(`Are you sure you want to permanently delete bike ${bike}?`)) {
                records = records.filter(r => r.id !== id);
                saveToStorage();
                renderMobileCards();
                updateMobileStats();
                showToast('🗑️ Record permanently deleted');
            }
        }

        // 7. Instant 1-Tap Toggle for Payment Status (auto-saved permanently)
        function togglePayStatus(id) {
            const r = records.find(item => item.id === id);
            if (!r) return;
            if (r.paymentStatus === 'Paid') {
                r.paymentStatus = 'Pending';
            } else {
                r.paymentStatus = 'Paid';
                if ((!r.advanceAmount || r.advanceAmount < r.amount) && r.amount > 0) {
                    r.advanceAmount = r.amount; // Mark full payment
                }
            }
            saveToStorage();
            renderMobileCards();
            updateMobileStats();
            showToast(`Status updated to ${r.paymentStatus}`);
        }

        // Open Advance Amount Modal from Details
        function openAdvanceModal(id) {
            const r = records.find(item => item.id === id);
            if (!r) return;

            const total = parseFloat(r.amount) || 0;
            const currentAdv = parseFloat(r.advanceAmount) || 0;
            const balance = Math.max(0, total - currentAdv);

            document.getElementById('advModalRecordId').value = r.id;
            document.getElementById('advModalBike').innerText = r.bikeNumber;
            document.getElementById('advModalCust').innerText = `${r.customerName} • ${r.customerPhone}`;
            document.getElementById('advModalTotal').innerText = `₹${total}`;
            document.getElementById('advModalCurrent').innerText = `₹${currentAdv}`;
            document.getElementById('advModalBalance').innerText = `₹${balance}`;
            document.getElementById('advModalInput').value = currentAdv > 0 ? currentAdv : '';

            document.getElementById('advanceModal').classList.remove('hidden');
        }

        function closeAdvanceModal(e) {
            if (e && e.target !== e.currentTarget && e.target.id !== 'advanceModal') return;
            document.getElementById('advanceModal').classList.add('hidden');
        }

        function setQuickAdv(val) {
            const current = parseFloat(document.getElementById('advModalInput').value) || 0;
            document.getElementById('advModalInput').value = current + val;
        }

        function setQuickFullPaid() {
            const id = document.getElementById('advModalRecordId').value;
            const r = records.find(item => item.id === id);
            if (r) {
                document.getElementById('advModalInput').value = parseFloat(r.amount) || 0;
            }
        }

        function saveAdvanceModal() {
            const id = document.getElementById('advModalRecordId').value;
            const r = records.find(item => item.id === id);
            if (!r) return;

            const newAdv = parseFloat(document.getElementById('advModalInput').value) || 0;
            const total = parseFloat(r.amount) || 0;

            r.advanceAmount = newAdv;
            if (newAdv >= total && total > 0) {
                r.paymentStatus = 'Paid';
            } else if (newAdv < total && r.paymentStatus === 'Paid') {
                r.paymentStatus = 'Pending';
            }

            saveToStorage();
            closeAdvanceModal();
            renderMobileCards();
            updateMobileStats();
            showToast(`💰 Advance ₹${newAdv} saved for ${r.bikeNumber}`);
        }

        // 8. Render Mobile Cards List
        function renderMobileCards() {
            const container = document.getElementById('mobileCardsList');
            const search = document.getElementById('mobileSearchInput').value.toLowerCase().trim();

            container.innerHTML = '';

            const filtered = records.filter(r => {
                return !search ||
                    r.bikeNumber.toLowerCase().includes(search) ||
                    r.customerName.toLowerCase().includes(search) ||
                    r.customerPhone.toLowerCase().includes(search) ||
                    (r.bikeModel && r.bikeModel.toLowerCase().includes(search));
            });

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:40px 16px; color:var(--text-muted);">
                        <div style="font-size:36px; margin-bottom:8px;">🔍</div>
                        <p style="font-weight:700;">No records found</p>
                        <p style="font-size:0.85rem; margin-top:4px;">Tap "Enter Details" button below to add new bikes.</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(r => {
                const totalAmt = parseFloat(r.amount) || 0;
                const advAmt = parseFloat(r.advanceAmount) || 0;
                const balance = Math.max(0, totalAmt - advAmt);
                const isPaid = (r.paymentStatus === 'Paid');

                const card = document.createElement('div');
                card.className = 'job-card';

                const waMsg = encodeURIComponent(
                    `*Suresh Bike Mechanics*\n` +
                    `Bike: ${r.bikeNumber}\n` +
                    `Customer: ${r.customerName}\n` +
                    `Work Done: ${r.workDesc || 'Service'}\n` +
                    `Total: ₹${totalAmt}\n` +
                    `Advance: ₹${advAmt}\n` +
                    `Balance Due: ₹${balance}\n` +
                    `Status: ${balance === 0 ? 'Fully Paid ✅' : 'Balance Pending ⏳'}`
                );
                const waLink = `https://wa.me/91${r.customerPhone.replace(/[^0-9]/g,'')}?text=${waMsg}`;

                card.innerHTML = `
                    <div class="job-card-top">
                        <span class="plate-box">${r.bikeNumber}</span>
                        <span class="job-date">📅 ${r.date}</span>
                    </div>

                    <div class="customer-row">
                        <div class="customer-meta">
                            <h3>${r.customerName}</h3>
                            <p>${r.bikeModel || 'Bike Service'}</p>
                        </div>
                        <div class="contact-actions">
                            <a href="tel:${r.customerPhone}" class="contact-btn call-btn" title="Call Customer">📞</a>
                            <a href="${waLink}" target="_blank" class="contact-btn wa-btn" title="Send Bill on WhatsApp">💬</a>
                        </div>
                    </div>

                    <div class="service-details-row">
                        <div class="work-text">${r.workDesc || 'General bike service'}</div>
                        <div class="amount-breakdown">
                            <div class="amount-total">₹${totalAmt}</div>
                            ${advAmt > 0 ? `<div class="amount-advance">Adv: ₹${advAmt}</div>` : ''}
                            ${totalAmt > 0 ? `<div class="amount-balance ${balance === 0 ? 'cleared' : ''}">${balance === 0 ? '✓ Paid in Full' : `Due: ₹${balance}`}</div>` : ''}
                        </div>
                    </div>

                    <div class="card-actions-row">
                        <button class="pay-pill-toggle ${isPaid ? 'is-paid' : 'is-pending'}" onclick="togglePayStatus('${r.id}')">
                            ${isPaid ? '✓ Paid' : (advAmt > 0 ? `⏳ Due ₹${balance}` : '⏳ Pending')}
                        </button>
                        <div class="crud-buttons">
                            <button class="btn-crud advance-btn" onclick="openAdvanceModal('${r.id}')">💰 Advance</button>
                            <button class="btn-crud" onclick="editMobileRecord('${r.id}')">✏️ Edit</button>
                            <button class="btn-crud delete-btn" onclick="deleteMobileRecord('${r.id}')">🗑️ Delete</button>
                        </div>
                    </div>
                `;

                container.appendChild(card);
            });
        }

        // 9. Update Stats & Badges
        function updateMobileStats() {
            const total = records.length;
            const paid = records.filter(r => r.paymentStatus === 'Paid').length;
            const pending = records.filter(r => r.paymentStatus === 'Pending').length;

            document.getElementById('miniTotalBikes').innerText = total;
            document.getElementById('miniPaidBikes').innerText = paid;
            document.getElementById('miniPendingBikes').innerText = pending;
            document.getElementById('mobileBadgeCount').innerText = total;
        }

        // 10. Permanent Storage Saver (LocalStorage + IndexedDB)
        function saveToStorage() {
            try {
                localStorage.setItem(DB_KEY, JSON.stringify(records));
            } catch (e) {
                console.error("LocalStorage save error:", e);
            }
            saveToIndexedDB(records);
        }

        // Export Data to CSV Backup
        function exportCustomerCSV() {
            if (!records || records.length === 0) {
                alert('No records available to backup.');
                return;
            }
            let csv = "Bike Number,Customer Name,Phone,Model,Total Amount,Advance Amount,Balance Due,Status,Work Description,Date\n";
            records.forEach(r => {
                const total = r.amount || 0;
                const adv = r.advanceAmount || 0;
                const bal = Math.max(0, total - adv);
                csv += `"${r.bikeNumber}","${r.customerName}","${r.customerPhone}","${r.bikeModel || ''}",${total},${adv},${bal},"${r.paymentStatus}","${(r.workDesc || '').replace(/"/g, '""')}","${r.date}"\n`;
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Suresh_Bikes_Backup_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('📥 Backup CSV Downloaded');
        }

        // 11. Toast Message
        function showToast(msg) {
            const toast = document.getElementById('mobileToast');
            toast.innerText = msg;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 2200);
        }

        // 12. Black & White Theme Switcher
        function toggleMobileTheme() {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('suresh_bike_theme', isDark ? 'dark' : 'white');
            updateThemeUI(isDark);
        }

        function initTheme() {
            const saved = localStorage.getItem('suresh_bike_theme');
            if (saved === 'dark') {
                document.body.classList.add('dark-theme');
                updateThemeUI(true);
            } else {
                document.body.classList.remove('dark-theme');
                updateThemeUI(false);
            }
        }

        function updateThemeUI(isDark) {
            document.getElementById('themeEmoji').innerText = isDark ? '⚪' : '⚫';
            document.getElementById('themeTitle').innerText = isDark ? 'White' : 'Black';
        }
