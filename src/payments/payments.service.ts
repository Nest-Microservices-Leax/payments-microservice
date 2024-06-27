import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSesionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {
  private readonly stripe = new Stripe(envs.stripeSecret);

  async createPaymentSession(paymentSessionDto: PaymentSesionDto) {
    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map((item) => {
      return {
        price_data: {
          currency: currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100), // 20euro (200/ 100) asi funciona
        },
        quantity: item.quantity,
      };
    });

    const session = await this.stripe.checkout.sessions.create({
      //* Put here order id
      payment_intent_data: {
        metadata: {
          orderId: orderId
        },
      },

      //* Items what people are buying
      line_items: lineItems,
      mode: 'payment',
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });
    return session;
  }

  async stripeWebhook(req: Request, res: Response) {
    const signature = req.headers['stripe-signature'];

    let event: Stripe.Event;

    const endpointSecret =
      envs.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(req['rawBody'], signature, endpointSecret);
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log({ event });
    
    switch( event.type ) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object;
        // TODO: call microservice
        console.log({
          metadata: chargeSucceeded.metadata,
          orderId: chargeSucceeded.metadata.orderId
        });
        break;

      default:
        console.log(`Event ${ event.type } no handled`);
    }

    return res.status(200).json({ signature });
  }
}
