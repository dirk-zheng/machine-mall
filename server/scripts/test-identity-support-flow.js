const assert = require('node:assert/strict');
const { WebSocket } = require('ws');

const baseUrl = process.env.TEST_WS_URL || 'ws://127.0.0.1:3001/ws';

function connect(visitorId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${baseUrl}?visitorId=${encodeURIComponent(visitorId)}`);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function request(socket, type, payload = {}) {
  return new Promise((resolve, reject) => {
    const requestId = `${Date.now()}-${Math.random()}`;
    const onMessage = (raw) => {
      const response = JSON.parse(raw.toString());
      if (response.requestId !== requestId) return;
      socket.off('message', onMessage);
      if (response.success) resolve(response.data);
      else reject(new Error(`${type}: ${response.error}`));
    };
    socket.on('message', onMessage);
    socket.send(JSON.stringify({ type, requestId, payload }));
  });
}

async function main() {
  const buyerPassword = process.env.TEST_BUYER_PASSWORD;
  const sellerPassword = process.env.TEST_SELLER_PASSWORD;
  if (!buyerPassword || !sellerPassword) throw new Error('Test account passwords are required');

  const runId = Date.now();
  const buyerVisitorId = `identity-flow-buyer-${runId}`;
  const sellerVisitorId = `identity-flow-seller-${runId}`;
  const buyer = await connect(buyerVisitorId);
  const seller = await connect(sellerVisitorId);
  try {
    const buyerLogin = await request(buyer, 'auth.login', { account: 'buyer_demo_0904', password: buyerPassword });
    const sellerLogin = await request(seller, 'auth.login', { account: 'seller_demo_0904', password: sellerPassword });
    assert.equal(buyerLogin.user.account, 'buyer_demo_0904');
    assert.equal(sellerLogin.user.account, 'seller_demo_0904');
    assert.ok(!Object.hasOwn(JSON.parse(Buffer.from(buyerLogin.token.split('.')[1], 'base64url')), 'id'));

    const products = await request(buyer, 'products.list');
    assert.ok(products.list.length > 0);
    await request(buyer, 'assortment.add', { productId: products.list[0].id, quantity: 1 });
    const assortment = await request(buyer, 'assortment.get');
    assert.ok(assortment.items.some((item) => item.product.id === products.list[0].id));

    const buyerSupport = await request(buyer, 'support.conversation.get');
    assert.equal(buyerSupport.conversation.customerVisitorId, buyerVisitorId);
    assert.equal(buyerSupport.conversation.status, 'waiting_human');

    const queue = await request(seller, 'support.queue.list');
    const queued = queue.find((item) => item.id === buyerSupport.conversation.id);
    assert.ok(queued);
    await request(seller, 'support.conversation.claim', { conversationId: queued.id });
    const sellerMessage = await request(seller, 'support.message.send', { conversationId: queued.id, content: 'Seller identity-flow test reply.' });
    assert.equal(sellerMessage.conversation.assignedAccount, 'seller_demo_0904');
    await request(buyer, 'support.message.send', { conversationId: queued.id, content: 'Buyer identity-flow test reply.' });

    const behavior = await request(buyer, 'behavior.context');
    assert.ok(behavior.visitorIds.includes(buyerVisitorId));
    console.log(JSON.stringify({
      login: 'passed', jwtUsesAccount: true, rfqByVisitorId: 'passed',
      supportCustomerVisitorId: buyerSupport.conversation.customerVisitorId,
      sellerAssignmentAccount: sellerMessage.conversation.assignedAccount,
      mergedVisitorCount: behavior.visitorIds.length,
    }));
  } finally {
    buyer.close();
    seller.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
