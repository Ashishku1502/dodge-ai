const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, '..', 'data', 'sap-o2c-data');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'data', 'graph_data.json');

async function processFile(filePath, callback) {
    if (!fs.existsSync(filePath)) return;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.trim()) {
            try {
                callback(JSON.parse(line));
            } catch (e) {
                console.error(`Error parsing line in ${filePath}:`, e.message);
            }
        }
    }
}

async function generateGraph() {
    const nodes = new Map();
    const edges = [];

    const addNode = (id, label, type, properties = {}) => {
        if (!id) return;
        if (!nodes.has(id)) {
            nodes.set(id, { id, label, type, ...properties });
        }
    };

    const addEdge = (source, target, label) => {
        if (!source || !target) return;
        edges.push({ source, target, label });
    };

    // 1. Process Business Partners
    console.log('Processing Business Partners...');
    const bpDir = path.join(DATA_DIR, 'business_partners');
    for (const file of fs.readdirSync(bpDir)) {
        await processFile(path.join(bpDir, file), (data) => {
            addNode(data.businessPartner, data.businessPartnerFullName || data.businessPartnerName, 'Partner', data);
        });
    }

    // 2. Process Products
    console.log('Processing Products...');
    const productDir = path.join(DATA_DIR, 'products');
    for (const file of fs.readdirSync(productDir)) {
        await processFile(path.join(productDir, file), (data) => {
            addNode(data.product, `Product: ${data.product}`, 'Product', data);
        });
    }

    // 3. Process Sales Orders
    console.log('Processing Sales Orders...');
    const soHeaderDir = path.join(DATA_DIR, 'sales_order_headers');
    for (const file of fs.readdirSync(soHeaderDir)) {
        await processFile(path.join(soHeaderDir, file), (data) => {
            const id = data.salesOrder;
            addNode(id, `Order ${id}`, 'SalesOrder', data);
            addEdge(id, data.soldToParty, 'ORDERED_BY');
        });
    }

    // 4. Process Outbound Deliveries
    console.log('Processing Deliveries...');
    const deliveryHeaderDir = path.join(DATA_DIR, 'outbound_delivery_headers');
    const deliveryItemDir = path.join(DATA_DIR, 'outbound_delivery_items');
    
    // We need to link Delivery to Sales Order via Items
    const deliveryToSO = new Map();
    for (const file of fs.readdirSync(deliveryItemDir)) {
        await processFile(path.join(deliveryItemDir, file), (data) => {
            if (data.referenceSdDocument) {
                deliveryToSO.set(data.deliveryDocument, data.referenceSdDocument);
            }
        });
    }

    for (const file of fs.readdirSync(deliveryHeaderDir)) {
        await processFile(path.join(deliveryHeaderDir, file), (data) => {
            const id = data.deliveryDocument;
            addNode(id, `Delivery ${id}`, 'Delivery', data);
            const soId = deliveryToSO.get(id);
            if (soId) {
                addEdge(id, soId, 'DELIVERED_FROM');
            }
        });
    }

    // 5. Process Billing Documents
    console.log('Processing Billing Documents...');
    const billingHeaderDir = path.join(DATA_DIR, 'billing_document_headers');
    const billingItemDir = path.join(DATA_DIR, 'billing_document_items');

    const billingToRef = new Map();
    for (const file of fs.readdirSync(billingItemDir)) {
        await processFile(path.join(billingItemDir, file), (data) => {
            if (data.referenceSdDocument) {
                billingToRef.set(data.billingDocument, data.referenceSdDocument);
            }
        });
    }

    for (const file of fs.readdirSync(billingHeaderDir)) {
        await processFile(path.join(billingHeaderDir, file), (data) => {
            const id = data.billingDocument;
            addNode(id, `Invoice ${id}`, 'Billing', data);
            const refId = billingToRef.get(id);
            if (refId) {
                // Could be from delivery or SO
                addEdge(id, refId, 'BILLED_FROM');
            }
            if (data.accountingDocument) {
                addEdge(id, data.accountingDocument, 'POSTED_TO');
            }
        });
    }

    // 6. Process Accounting / Journal Entries
    console.log('Processing Journal Entries...');
    const journalEntryDir = path.join(DATA_DIR, 'journal_entry_items_accounts_receivable');
    for (const file of fs.readdirSync(journalEntryDir)) {
        await processFile(path.join(journalEntryDir, file), (data) => {
            const id = data.accountingDocument;
            addNode(id, `Journal Entry ${id}`, 'JournalEntry', data);
            if (data.referenceDocument) {
                addEdge(id, data.referenceDocument, 'POSTED_FROM');
            }
        });
    }

    // 7. Process Payments
    console.log('Processing Payments...');
    const paymentDir = path.join(DATA_DIR, 'payments_accounts_receivable');
    for (const file of fs.readdirSync(paymentDir)) {
        await processFile(path.join(paymentDir, file), (data) => {
            const id = data.clearingAccountingDocument;
            addNode(id, `Payment ${id}`, 'Payment', data);
            if (data.accountingDocument) {
                addEdge(id, data.accountingDocument, 'CLEARS');
            }
        });
    }

    // Final Graph Structure
    const graph = {
        nodes: Array.from(nodes.values()),
        links: edges
    };

    if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graph, null, 2));
    console.log(`Graph generated with ${graph.nodes.length} nodes and ${graph.links.length} links.`);
}

generateGraph().catch(console.error);
