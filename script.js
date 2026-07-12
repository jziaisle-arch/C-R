document.addEventListener("DOMContentLoaded", () => {

    // --- UI ELEMENTS ---
    const infoModal = document.getElementById("infoModal");
    const openModalBtn = document.getElementById("openModalBtn");
    const closeModalBtn = document.getElementById("closeModalBtn");

    const accordionHeaders = document.querySelectorAll(".accordion-header");
    const accordionContents = document.querySelectorAll(".accordion-content");

    const balanceDisplay = document.getElementById("balanceDisplay");

    const captchaDisplay = document.getElementById("captchaDisplay");
    const captchaInput = document.getElementById("captchaInput");
    const captchaSubmitBtn = document.getElementById("captchaSubmitBtn");

    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    const message = document.getElementById("message");

    const promoInput = document.getElementById("promoInput");
    const promoSubmitBtn = document.getElementById("promoSubmitBtn");
    const promoStatus = document.getElementById("promoStatus");

    const payoutMethod = document.getElementById("payoutMethod");
    const payoutAccount = document.getElementById("payoutAccount");
    const payoutAmount = document.getElementById("payoutAmount");
    const payoutSubmitBtn = document.getElementById("payoutSubmitBtn");
    const payoutStatus = document.getElementById("payoutStatus");

    const historyList = document.getElementById("historyList");
    const emptyHistoryText = document.getElementById("emptyHistoryText");

    const toastContainer = document.getElementById("toastContainer");


    // --- SAVED DATA ---
    let currentBalance = Number(localStorage.getItem("balance")) || 0.000;
    let captchaCount = Number(localStorage.getItem("captchaCount")) || 0;
    let isPromoRedeemed = localStorage.getItem("promoRedeemed") === "true";
    let historyData = JSON.parse(localStorage.getItem("history")) || [];

    const maxCaptchas = 10;

    function saveData(){
        localStorage.setItem("balance", currentBalance);
        localStorage.setItem("captchaCount", captchaCount);
        localStorage.setItem("promoRedeemed", isPromoRedeemed);
        localStorage.setItem("history", JSON.stringify(historyData));
    }

    // --- TOAST SYSTEM ---
    function triggerToast(text, type = "info"){
        if(!toastContainer) return;

        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">
            ${
                type === "success" ? "☑" :
                type === "error" ? "☒" :
                type === "warning" ? "⚠︎" : ""
            }
            </span>
            <span>${text}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add("show");
        }, 50);

        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3500);
    }

    // --- PHONE FORMATTER ---
    if(payoutAccount){
        payoutAccount.addEventListener("input", () => {
            let value = payoutAccount.value.replace(/\D/g, "");
            value = value.substring(0, 11);

            if(value.length > 7){
                value = value.substring(0, 4) + " " + value.substring(4, 7) + " " + value.substring(7);
            } else if(value.length > 4){
                value = value.substring(0, 4) + " " + value.substring(4);
            }
            payoutAccount.value = value;
        });
    }
    
    function fetchCurrentTime(){
        return new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });
    }

    // --- TRANSACTION HISTORY ENGINE ---
    // Added an appendToStorage flag to prevent duplicate record multiplication during page reload loops
    function processHistoryStack(title, time, value, mode, status, appendToStorage = true){
        if(emptyHistoryText){
            emptyHistoryText.style.display = "none";
        }

        if(!historyList) return;

        const row = document.createElement("div");
        row.className = "history-item";
        row.innerHTML = `
            <div class="history-meta">
                <h4>${title}</h4>
                <span>Time: ${time}</span>
            </div>
            <div class="history-value">
                <span class="history-amt ${mode}">
                    ${mode === "minus" ? "-" : "+"}₱${Number(value).toFixed(3)}
                </span>
                <span class="history-status ${status.toLowerCase()}">${status}</span>
            </div>
        `;

        historyList.prepend(row);

        if (appendToStorage) {
            historyData.unshift({
                title: title,
                time: time,
                value: value,
                mode: mode,
                status: status
            });
            saveData();
        }
    }

    // --- LOAD OLD HISTORY CORRECTLY ---
    if(historyData.length > 0 && emptyHistoryText) {
        emptyHistoryText.style.display = "none";
    }
    // Read array backwards to prepend them in the exact, correct structural order
    for(let i = historyData.length - 1; i >= 0; i--) {
        processHistoryStack(
            historyData[i].title,
            historyData[i].time,
            historyData[i].value,
            historyData[i].mode,
            historyData[i].status,
            false // DO NOT write back to array during render loop
        );
    }

    // --- MODAL CONTROLS ---
    if(openModalBtn && infoModal){
        openModalBtn.onclick = (e) => {
            e.preventDefault();
            infoModal.classList.add("open");
        };
    }

    if(closeModalBtn && infoModal){
        closeModalBtn.onclick = (e) => {
            e.preventDefault();
            infoModal.classList.remove("open");
        };
    }

    window.onclick = (e) => {
        if(e.target === infoModal){
            infoModal.classList.remove("open");
        }
    };

    // --- ACCORDION CODES ---
    accordionHeaders.forEach(header => {
        header.addEventListener("click", e => {
            e.preventDefault();
            const targetId = header.getAttribute("data-tab");
            const target = document.getElementById(targetId);

            accordionHeaders.forEach(h => h.classList.remove("active"));
            accordionContents.forEach(c => c.classList.remove("active"));

            header.classList.add("active");
            if(target) target.classList.add("active");
        });
    });

    // --- CAPTCHA GENERATOR ---
    function generateCaptcha(){
        if(!captchaDisplay) return;
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let result = "";
        for(let i = 0; i < 5; i++){
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        captchaDisplay.textContent = result;
    }

    // --- CAPTCHA VERIFY ---
    if(captchaSubmitBtn){
        captchaSubmitBtn.onclick = e => {
            e.preventDefault();
            const input = captchaInput.value.trim().toUpperCase();
            const correct = captchaDisplay.textContent;

            if(input === correct){
                captchaCount++;
                if(message) message.textContent = "☑ Correct Captcha";

                if(captchaCount >= maxCaptchas){
                    currentBalance += 1.350;
                    captchaCount = 0;

                    processHistoryStack(
                        "Captcha Milestone",
                        fetchCurrentTime(),
                        1.350,
                        "plus",
                        "COMPLETED"
                    );

                    triggerToast("Milestone Complete! +₱1.350", "success");
                } else {
                }

                saveData();

                if(balanceDisplay){
                    balanceDisplay.textContent = `₱${currentBalance.toFixed(3)}`;
                }

                if(progressFill){
                    progressFill.style.width = `${(captchaCount / maxCaptchas) * 100}%`;
                }

                if(progressText){
                    progressText.textContent = `${captchaCount} / ${maxCaptchas}`;
                }

                captchaInput.value = "";
                generateCaptcha();
            } else {
                if(message) {
                    message.textContent = "☒ Incorrect Captcha";
                }
            }
        };
    }

    if(captchaInput){
        captchaInput.addEventListener("keydown", e => {
            if(e.key === "Enter"){
                e.preventDefault();
                if(captchaSubmitBtn) captchaSubmitBtn.click();
            }
        });
    }
    
    // --- PROMO CODE SYSTEM ---
    if(promoSubmitBtn){
        promoSubmitBtn.onclick = e => {
            e.preventDefault();
            const code = promoInput.value.trim().toUpperCase();

            if(code === "4F82I5RQ"){
                if(isPromoRedeemed){
                    if(promoStatus) promoStatus.textContent = "This voucher has already been claimed.";
                    return;
                }

                currentBalance += 200;
                isPromoRedeemed = true;
                saveData();

                if(balanceDisplay) balanceDisplay.textContent = `₱${currentBalance.toFixed(3)}`;

                processHistoryStack(
                    "Promo: 4F82I5RQ",
                    fetchCurrentTime(),
                    200,
                    "plus",
                    "COMPLETED"
                );

                if(promoStatus) promoStatus.textContent = "Voucher successfully applied!";
                triggerToast("Promo +₱200.00 added", "success");
                promoInput.value = "";
            } else {
                if(promoStatus) promoStatus.textContent = "Invalid promo code.";
            }
        };
    }

    // --- PAYOUT SYSTEM ---
    if(payoutSubmitBtn){
        payoutSubmitBtn.onclick = e => {
            e.preventDefault();
            const method = payoutMethod.value;
            const account = payoutAccount.value.trim();
            const amount = Number(payoutAmount.value);

            if(!method || !account || isNaN(amount) || amount <= 0){
                if(payoutStatus) payoutStatus.textContent = "Please complete all fields.";
                return;
            }

            if(amount < 100){
                if(payoutStatus) payoutStatus.textContent = "Minimum payout is ₱100.";
                return;
            }

            if(amount > currentBalance){
                if(payoutStatus) payoutStatus.textContent = "Insufficient funds.";
                return;
            }

            const cleanAccount = account.replace(/\s/g, "");
            currentBalance -= amount;
            saveData();

            if(balanceDisplay) balanceDisplay.textContent = `₱${currentBalance.toFixed(3)}`;
            if(payoutStatus) payoutStatus.textContent = "";

            processHistoryStack(
                `Payout (${method})`,
                fetchCurrentTime(),
                amount,
                "minus",
                "PENDING"
            );

            triggerToast(`Payout ₱${amount.toFixed(2)} success!`, "success");

            console.log({
                method,
                account: cleanAccount,
                amount
            });

            payoutAccount.value = "";
            payoutAmount.value = "";
        };
    }

    // --- INITIAL LAYOUT LOAD ---
    if(balanceDisplay) balanceDisplay.textContent = `₱${currentBalance.toFixed(3)}`;
    if(progressText) progressText.textContent = `${captchaCount} / ${maxCaptchas}`;
    if(progressFill) progressFill.style.width = `${(captchaCount / maxCaptchas) * 100}%`;

    generateCaptcha();
});
