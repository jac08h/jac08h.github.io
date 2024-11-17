function switchTargetType() {
    const targetType = document.getElementById('targetType').value;
    const targetHeader = document.getElementById('targetHeader');
    const targetInputs = document.getElementsByClassName('target');
    const headers = document.querySelector('.headers');
    const personInputs = document.querySelectorAll('.person-inputs');

    // Show/hide target column
    if (targetType === 'none') {
        headers.style.gridTemplateColumns = '1fr 1fr';
        personInputs.forEach(div => div.style.gridTemplateColumns = '1fr 1fr');
        targetHeader.style.display = 'none';
        Array.from(targetInputs).forEach(input => input.style.display = 'none');
    } else {
        headers.style.gridTemplateColumns = '1fr 1fr 1fr';
        personInputs.forEach(div => div.style.gridTemplateColumns = '1fr 1fr 1fr');
        targetHeader.style.display = 'block';
        Array.from(targetInputs).forEach(input => input.style.display = 'block');

        if (targetType === 'percentage') {
            targetHeader.textContent = 'Target percentage';
            const totalPaid = Array.from(document.getElementsByClassName('amount')).reduce((sum, input) => sum + Number(input.value), 0);
            const n = targetInputs.length;
            const prefillValue = (totalPaid / n * 100).toFixed(2);
            Array.from(targetInputs).forEach(input => {
                input.placeholder = 'e.g. 50';
                input.max = '100';
                input.step = '1';
                input.value = prefillValue;
            });
        } else {
            targetHeader.textContent = 'Target amount';
            const totalPaid = Array.from(document.getElementsByClassName('amount')).reduce((sum, input) => sum + Number(input.value), 0);
            const n = targetInputs.length;
            const prefillValue = (totalPaid / n).toFixed(2);
            Array.from(targetInputs).forEach(input => {
                input.placeholder = 'e.g. 50.00';
                input.removeAttribute('max');
                input.step = '0.01';
                input.value = prefillValue;
            });
        }
    }
}

function addPerson() {
    const people = document.getElementById('people');
    const count = people.children.length + 1;
    const nameChar = String.fromCharCode(65 + count - 1);
    const div = document.createElement('div');
    div.className = 'person-inputs';

    const targetType = document.getElementById('targetType').value;
    const targetDisplay = targetType === 'none' ? 'none' : 'block';
    const gridCols = targetType === 'none' ? '1fr 1fr' : '1fr 1fr 1fr';
    div.style.gridTemplateColumns = gridCols;

    const targetPlaceholder = targetType === 'percentage' ? 'e.g. 50' : 'e.g. 50.00';
    const targetStep = targetType === 'percentage' ? '1' : '0.01';
    const targetMax = targetType === 'percentage' ? 'max="100"' : '';

    div.innerHTML = `
        <input type="text" placeholder="Name" value="${nameChar}">
        <input type="number" placeholder="Amount paid" value="0" min="0" class="amount">
        <input type="number" step="${targetStep}" placeholder="${targetPlaceholder}"
               min="0" ${targetMax} class="target" style="display: ${targetDisplay}">
    `;
    people.appendChild(div);
}

function removePerson() {
    const people = document.getElementById('people');
    if (people.children.length > 2) {
        people.removeChild(people.lastChild);
    }
}

function validate() {
    const people = document.getElementById('people');
    const error = document.getElementById('error');
    const targetType = document.getElementById('targetType').value;
    error.classList.add('hidden');

    let amounts = [];
    let targets = [];

    try {
        amounts = Array.from(people.getElementsByClassName('amount'))
            .map(input => {
                const parsed = parseFloat(input.value);
                if (isNaN(parsed)) {
                    throw new Error('Invalid amount format');
                }
                return parsed;
            });
    } catch (e) {
        error.textContent = 'Please enter valid numbers for amounts paid.';
        error.classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
        return false;
    }

    try {
        targets = Array.from(people.getElementsByClassName('target'))
            .map(input => {
                if (!input.value) return null;
                const parsed = parseFloat(input.value);
                if (isNaN(parsed)) {
                    throw new Error('Invalid target format');
                }
                return parsed;
            });
    } catch (e) {
        error.textContent = 'Please enter valid numbers for target values.';
        error.classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
        return false;
    }

    let is_ok = true;

    if (amounts.some(a => a < 0)) {
        error.textContent = 'Amounts paid cannot be negative.';
        is_ok = false;
    }

    if (targets.some(t => t !== null && t < 0)) {
        error.textContent = 'Target values cannot be negative.';
        is_ok = false;
    }

    if (is_ok && targets.some(t => t !== null)) {
        // All targets must be filled
        if (targets.some(t => t === null)) {
            error.textContent = `If using target ${targetType}, all values must be specified.`;
            is_ok = false;
        }

        if (targetType === 'percentage') {
            // Percentages must sum to 100
            const sum = targets.reduce((a, b) => a + b, 0);
            if (Math.abs(sum - 100) > 0.01) {
                error.textContent = `Percentages must sum to 100. Current sum: ${sum.toFixed(1)}%`;
                is_ok = false;
            }
        } else {
            // Target amounts must sum to total paid
            const totalPaid = amounts.reduce((a, b) => a + b, 0);
            const targetSum = targets.reduce((a, b) => a + b, 0);
            if (Math.abs(targetSum - totalPaid) > 0.01) {
                error.textContent = `Target amounts must sum to total paid (${totalPaid.toFixed(2)}). Current sum: ${targetSum.toFixed(2)}`;
                is_ok = false;
            }
        }
    }

    if (!is_ok) {
        error.classList.remove('hidden');
        document.getElementById('results').classList.add('hidden');
    }
    return is_ok;
}

function calculateTransfers(amounts, targets) {
    const n = amounts.length;
    const total = amounts.reduce((a, b) => a + b, 0);
    const targetType = document.getElementById('targetType').value;

    let targetAmounts;
    if (targets.some(t => t !== null)) {
        targetAmounts = targetType === 'percentage'
            ? targets.map(t => total * t / 100)
            : targets;
    } else {
        targetAmounts = Array(n).fill(total / n);
    }

    let balances = amounts.map((a, i) => a - targetAmounts[i]);
    let transfers = [];

    while (true) {
        let maxDebtorIdx = balances.indexOf(Math.min(...balances));
        let maxCreditorIdx = balances.indexOf(Math.max(...balances));

        if (Math.abs(balances[maxDebtorIdx]) < 0.01) break;

        let amount = Math.min(-balances[maxDebtorIdx], balances[maxCreditorIdx]);
        transfers.push([maxDebtorIdx, maxCreditorIdx, amount]);

        balances[maxDebtorIdx] += amount;
        balances[maxCreditorIdx] -= amount;
    }

    return [transfers, targetAmounts];
}

function calculate() {
    if (!validate()) return;

    const people = document.getElementById('people');
    const inputs = Array.from(people.getElementsByTagName('input'));

    const names = inputs.filter(input => input.type === 'text').map(input => input.value);
    const amounts = Array.from(people.getElementsByClassName('amount')).map(input => Number(input.value));
    const targets = Array.from(people.getElementsByClassName('target')).map(input => input.value ? Number(input.value) : null);

    const [transfers, finalAmounts] = calculateTransfers(amounts, targets);

    const results = document.getElementById('results');
    const total = amounts.reduce((a, b) => a + b, 0);

    results.innerHTML = '';
    if (transfers.length === 0) {
        results.innerHTML += '<p>No transfers needed!</p>';
    } else {
        transfers.forEach(([from, to, amount]) => {
            results.innerHTML += `<p>${names[from]} → <b>${amount.toFixed(2)}</b> → ${names[to]}</p>`;
        });
    }

    results.classList.remove('hidden');
}

function toggleExplanation() {
    const explanation = document.getElementById('algorithmExplanation');
    const button = document.getElementById('toggleAlgorithm');

    if (explanation.classList.contains('hidden')) {
        explanation.classList.remove('hidden');
        button.innerHTML = 'How it works ▲';
    } else {
        explanation.classList.add('hidden');
        button.innerHTML = 'How it works ▼';
    }
}

// Initialize the page
switchTargetType();