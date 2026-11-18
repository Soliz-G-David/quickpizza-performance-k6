import { orderPizzaFlow } from "../scenarios/orderPizza.js";

export const options = {
  stages: [
    { target: 100, duration: "1m" },
    { target: 200, duration: "1m" },
    { target: 300, duration: "1m" },
    { target: 400, duration: "1m" },
    { target: 0, duration: "1m" },
  ],

  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  orderPizzaFlow();
}