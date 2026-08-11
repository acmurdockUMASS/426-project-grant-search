import express from "express";
import amqp from "amqplib";

const PORT = process.env.PORT || 3000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://rabbitmq:5672";
const GRANT_ALERT_QUEUE = process.env.GRANT_ALERT_QUEUE || "grant-alert-jobs";
const PROCESSING_DELAY_MS = process.env.PROCESSING_DELAY_MS || 250;

const app = express();

let rabbitReady = false;

const delay = (ms) => new Promise((resolve)=>setTimeout(resolve,ms));

function writeConsumerLog(event, details = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      component: "consumer",
      event,
      ...details,
    }),
  );
}

async function processGrantAlert(message, channel) {
  if (!message) {
    return;
  }

  let job;

  try {
    job = JSON.parse(message.content.toString("utf8"));
  } catch (error) {
    writeConsumerLog("rejected", {
      reason: "invalid_json",
      message: error.message,
    });

    channel.nack(message, false, false);
    return;
  }

  const jobDetails = {
    jobId: job.jobId,
    organizationId: job.organizationId,
    grantId: job.grantId,
    alertType: job.alertType,
  };

  writeConsumerLog("picked_up", {
    ...jobDetails,
    queue: GRANT_ALERT_QUEUE,
  });

  try {
    await delay(PROCESSING_DELAY_MS);

    writeConsumerLog("processed", {
      ...jobDetails,
      processingDelayMs: PROCESSING_DELAY_MS,
    });

    channel.ack(message);
  } catch (error) {
    writeConsumerLog("processing_failed", {
      ...jobDetails,
      message: error.message,
    });

    try {
      channel.nack(message, false, true);
    } catch {
      writeConsumerLog("requeue_failed", {
        jobId: job.jobId,
      });
    }
  }
}

async function startRabbitConsumer() {
  let connection;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(GRANT_ALERT_QUEUE, {
      durable: true,
    });

    await channel.prefetch(1);

    await channel.consume(GRANT_ALERT_QUEUE, (message) => {
      void processGrantAlert(message, channel);
    });

    rabbitReady = true;

    connection.on("error", (error) => {
      writeConsumerLog("rabbitmq_error", {
        message: error.message,
      });
    });

    connection.on("close", () => {
      rabbitReady = false;
      writeConsumerLog("rabbitmq_disconnected");
      setTimeout(() => void startRabbitConsumer(), 2000);
    });

    writeConsumerLog("waiting_for_messages", {
      queue: GRANT_ALERT_QUEUE,
      prefetch: 1,
    });
  } catch (error) {
    rabbitReady = false;

    writeConsumerLog("rabbitmq_connection_failed", {
      message: error.message,
    });

    await connection?.close().catch(() => {});
    setTimeout(() => void startRabbitConsumer(), 2000);
  }
}

//GET /health
app.get("/health", (req, res) => {
  if (!rabbitReady) {
    return res.status(503).json({
      status: "starting",
    });
  }

  return res.json({
    status: "ok",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Grant Alert Worker health server is listening on port ${PORT}`);
});

void startRabbitConsumer();
