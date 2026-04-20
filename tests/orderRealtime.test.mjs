import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMyWebOrderEvent,
  canHideOrder,
  normalizeOrderStatus
} from '../src/features/orders/orderRealtime.js';

test('normalizeOrderStatus normaliza legacy', () => {
  assert.equal(normalizeOrderStatus('nuevo'), 'pendiente');
  assert.equal(normalizeOrderStatus('preparando'), 'en_proceso');
  assert.equal(normalizeOrderStatus('listo_para_cobrar'), 'listo');
});

test('canHideOrder permite solo entregado', () => {
  assert.equal(canHideOrder('entregado'), true);
  assert.equal(canHideOrder('listo'), false);
});

test('applyMyWebOrderEvent elimina pedido si cliente_visible es 0', () => {
  const next = applyMyWebOrderEvent([{
    id: 15,
    estado: 'entregado',
    cliente_visible: 1
  }], {
    type: 'order_hidden_by_user',
    order_id: 15,
    order: {
      id: 15,
      estado: 'entregado',
      cliente_visible: 0
    }
  });

  assert.equal(next.length, 0);
});
