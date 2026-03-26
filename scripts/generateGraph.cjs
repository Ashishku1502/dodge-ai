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

    const addNode = (id, type, label, props = {}) => {
        if (!id) return;
        nodes.set(String(id), { 
            id: String(id), 
            type, 
            label: label || String(id), 
            ...props 
        });
    };

    const addEdge = (source, target, label) => {
        if (!source || !target) return;
        // Ensure source and target are strings if they aren't already
        edges.push({ source: String(source), target: String(target), label });
    };

    // 1. Process Business Partners
    console.log('Processing Business Partners...');
    const bpDir = path.join(DATA_DIR, 'business_partners');
    for (const file of fs.readdirSync(bpDir)) {
        await processFile(path.join(bpDir, file), (data) => {
            // Corrected: type is 'Partner', label is the name
            addNode(data.businessPartner, 'Partner', data.businessPartnerFullName || data.businessPartnerName || 'Unknown Partner', data);
        });
    }

    // 2. Process Products
    console.log('Processing Products...');
    const productDir = path.join(DATA_DIR, 'products');
    for (const file of fs.readdirSync(productDir)) {
        await processFile(path.join(productDir, file), (data) => {
            // Corrected: type is 'Product', label is the ID
            addNode(data.product, 'Product', `Product: ${data.product}`, data);
        });
    }

    // 3. Process Sales Orders & Links to Products
    console.log('Processing Sales Orders...');
    const soHeaderDir = path.join(DATA_DIR, 'sales_order_headers');
    const soItemDir = path.join(DATA_DIR, 'sales_order_items');
    
    // Link SO to Products via Items
    const soItems = new Map();
    for (const file of fs.readdirSync(soItemDir)) {
        await processFile(path.join(soItemDir, file), (data) => {
            if (!soItems.has(data.salesOrder)) soItems.set(data.salesOrder, new Set());
            soItems.get(data.salesOrder).add(data.product);
        });
    }

    for (const file of fs.readdirSync(soHeaderDir)) {
        await processFile(path.join(soHeaderDir, file), (data) => {
            const id = data.salesOrder;
            addNode(id, 'SalesOrder', `Order ${id}`, data);
            addEdge(id, data.soldToParty, 'ORDERED_BY');
            
            // Link to Products
            const products = soItems.get(id);
            if (products) {
                products.forEach(pId => addEdge(id, pId, 'CONTAINS_PRODUCT'));
            }
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
            addNode(id, 'Delivery', `Delivery ${id}`, data);
            
            const soId = deliveryToSO.get(id);
            if (soId) {
                addEdge(id, soId, 'DELIVERED_FROM');
            }
            if (data.shipToParty) {
                addEdge(id, data.shipToParty, 'SHIP_TO');
            }
        });
    }

    // 5. Process Billing Documents
    console.log('Processing Billing Documents...');
    const billingHeaderDir = path.join(DATA_DIR, 'billing_document_headers');
    const billingItemDir = path.join(DATA_DIR, 'billing_document_items');

    const billingToRef = new Map();
    const billingItems = new Map();
    for (const file of fs.readdirSync(billingItemDir)) {
        await processFile(path.join(billingItemDir, file), (data) => {
            if (data.referenceSdDocument) {
                billingToRef.set(data.billingDocument, data.referenceSdDocument);
            }
            if (!billingItems.has(data.billingDocument)) billingItems.set(data.billingDocument, new Set());
            billingItems.get(data.billingDocument).add(data.product);
        });
    }

    for (const file of fs.readdirSync(billingHeaderDir)) {
        await processFile(path.join(billingHeaderDir, file), (data) => {
            const id = data.billingDocument;
            addNode(id, 'Billing', `Invoice ${id}`, data);
            const refId = billingToRef.get(id);
            if (refId) {
                addEdge(id, refId, 'BILLED_FROM');
            }
            // Link to Products
            const products = billingItems.get(id);
            if (products) {
                products.forEach(pId => addEdge(id, pId, 'CONTAINS_PRODUCT'));
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
            // Corrected: type is 'JournalEntry', label is descriptive
            addNode(id, 'JournalEntry', `Journal Entry ${id}`, data);
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
            // Corrected: type is 'Payment', label is descriptive
            addNode(id, 'Payment', `Payment ${id}`, data);
            if (data.accountingDocument) {
                addEdge(id, data.accountingDocument, 'CLEARS');
            }
        });
    }

    // Final Graph Structure
    const nodeIds = new Set(nodes.keys());
    const validLinks = edges.filter(link => {
        const hasSource = nodeIds.has(String(link.source));
        const hasTarget = nodeIds.has(String(link.target));
        if (!hasSource || !hasTarget) {
            // console.warn(`Filtering link: ${link.source} -> ${link.target} (Missing: ${!hasSource ? 'Source' : ''} ${!hasTarget ? 'Target' : ''})`);
            return false;
        }
        return true;
    });

    const graph = {
        nodes: Array.from(nodes.values()),
        links: validLinks
    };

    if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
        console.log(`Creating output directory: ${path.dirname(OUTPUT_FILE)}`);
        fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graph, null, 2));
    console.log(`✅ Graph successfully generated at: ${OUTPUT_FILE}`);
    console.log(`📊 Total: ${graph.nodes.length} nodes, ${graph.links.length} links.`);
    console.log(`🧹 Filtered ${edges.length - validLinks.length} dangling links.`);
}

generateGraph().catch(console.error);
