import { orderPizzaFlow } from "../scenarios/orderPizza.js";

export const options = {
  stages: [
    { target: 10, duration: "30s" },
    { target: 100, duration: "10s" },
    { target: 100, duration: "1m" },
    { target: 0, duration: "30s" },
  ],

  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  orderPizzaFlow();
}