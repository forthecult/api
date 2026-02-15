import { SEO_CONFIG } from "~/app";

import type { Notification } from "./notification-center";

export const mockNotifications: Notification[] = [
  {
    description: "You're in. Check out the shop when you're ready.",
    id: "1",
    read: false,
    timestamp: new Date(Date.now() - 60 * 1000), // 1 minute ago
    title: "You're in",
    type: "success",
  },
  {
    description: "There was an issue with your payment method.",
    id: "2",
    read: false,
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    title: "Payment Failed",
    type: "error",
  },
  {
    description: "Your order #1234 has shipped.",
    id: "3",
    read: false,
    timestamp: new Date(Date.now() - 3600 * 1000), // 1 hour ago
    title: "Order Shipped",
    type: "info",
  },
  {
    description: "The item on your wishlist is now back in stock!",
    id: "4",
    read: true,
    timestamp: new Date(Date.now() - 3600 * 1000), // 1 hour ago
    title: "New Product Available",
    type: "info",
  },
  {
    description: "Get 10% off your next purchase.",
    id: "5",
    read: true,
    timestamp: new Date(Date.now() - 2 * 86400 * 1000), // 2 days ago
    title: "Discount Available!",
    type: "warning",
  },
];
