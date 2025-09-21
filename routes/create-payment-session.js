const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_51S4brZ8HfEknvOjMj4WwaAEOi6PY2W3hVsXGMPbRPrM5sGCeXnWzqZDDTwoqPfQEO5korL6wbFMpr0z4tJH9lLEI00xbweJrXN');

// Create payment session
router.post('/', async (req, res) => {
  try {
    const { feeId, amount, description, studentId, userType } = req.body;

    if (!feeId || !amount) {
      return res.status(400).json({ error: 'Fee ID and amount are required' });
    }

    // Determine redirect URLs based on user type
    const dashboardPath = userType === 'parent' ? '/parent/dashboard' : '/student/dashboard';
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'lkr',
            product_data: {
              name: description || `School Fee Payment`,
              description: `Invoice: ${feeId}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents/paisa
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-result?payment=success&feeId=${feeId}&userType=${userType || 'student'}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-result?payment=cancel&feeId=${feeId}&userType=${userType || 'student'}`,
      metadata: {
        feeId: feeId,
        studentId: studentId || '',
        userType: userType || 'student',
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    console.error('Payment session creation error:', error);
    res.status(500).json({ 
      error: 'Payment session creation failed', 
      details: error.message 
    });
  }
});

module.exports = router;