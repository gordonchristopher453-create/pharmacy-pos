import { createSlice } from '@reduxjs/toolkit';

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    discount: 0,
    paymentMethod: 'cash',
  },
  reducers: {
    addItem: (state, action) => {
      const existing = state.items.find(i => i.product_id === action.payload.product_id);
      if (existing) {
        existing.quantity += action.payload.quantity || 1;
      } else {
        state.items.push({ ...action.payload, quantity: action.payload.quantity || 1 });
      }
    },
    removeItem: (state, action) => {
      state.items = state.items.filter(i => i.product_id !== action.payload);
    },
    updateQuantity: (state, action) => {
      const item = state.items.find(i => i.product_id === action.payload.product_id);
      if (item) {
        item.quantity = action.payload.quantity;
        if (item.quantity <= 0) {
          state.items = state.items.filter(i => i.product_id !== action.payload.product_id);
        }
      }
    },
    setDiscount: (state, action) => { state.discount = action.payload; },
    setPaymentMethod: (state, action) => { state.paymentMethod = action.payload; },
    clearCart: (state) => { state.items = []; state.discount = 0; state.paymentMethod = 'cash'; }
  }
});

export const { addItem, removeItem, updateQuantity, setDiscount, setPaymentMethod, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
