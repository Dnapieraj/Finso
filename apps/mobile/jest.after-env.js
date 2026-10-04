// Runs after the test framework is set up, so `beforeEach` exists here.
const { resetFakeServer } = require("./__tests__/helpers/fake-api");
const { resetNotifications } = require("./__tests__/helpers/fake-notifications");

beforeEach(() => {
  resetFakeServer();
  resetNotifications();
});
