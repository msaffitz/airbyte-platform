/*
 * Copyright (c) 2023 Airbyte, Inc., all rights reserved.
 */

package io.airbyte.container_orchestrator.config;

import io.airbyte.commons.features.EnvVariableFeatureFlags;
import io.airbyte.commons.features.FeatureFlags;
import io.airbyte.commons.temporal.sync.OrchestratorConstants;
import io.airbyte.config.EnvConfigs;
import io.airbyte.container_orchestrator.orchestrator.DbtJobOrchestrator;
import io.airbyte.container_orchestrator.orchestrator.JobOrchestrator;
import io.airbyte.container_orchestrator.orchestrator.NoOpOrchestrator;
import io.airbyte.container_orchestrator.orchestrator.NormalizationJobOrchestrator;
import io.airbyte.container_orchestrator.orchestrator.ReplicationJobOrchestrator;
import io.airbyte.persistence.job.models.JobRunConfig;
import io.airbyte.workers.config.WorkerConfigsProvider;
import io.airbyte.workers.general.ReplicationWorkerFactory;
import io.airbyte.workers.internal.state_aggregator.StateAggregatorFactory;
import io.airbyte.workers.process.AsyncOrchestratorPodProcess;
import io.airbyte.workers.process.DockerProcessFactory;
import io.airbyte.workers.process.KubePortManagerSingleton;
import io.airbyte.workers.process.KubeProcessFactory;
import io.airbyte.workers.process.ProcessFactory;
import io.airbyte.workers.storage.DocumentStoreClient;
import io.airbyte.workers.storage.StateClients;
import io.airbyte.workers.sync.DbtLauncherWorker;
import io.airbyte.workers.sync.NormalizationLauncherWorker;
import io.airbyte.workers.sync.ReplicationLauncherWorker;
import io.fabric8.kubernetes.client.DefaultKubernetesClient;
import io.micronaut.context.annotation.Factory;
import io.micronaut.context.annotation.Prototype;
import io.micronaut.context.annotation.Requires;
import io.micronaut.context.annotation.Value;
import io.micronaut.context.env.Environment;
import jakarta.inject.Named;
import jakarta.inject.Singleton;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

@Factory
class ContainerOrchestratorFactory {

  @Singleton
  FeatureFlags featureFlags() {
    return new EnvVariableFeatureFlags();
  }

  @Singleton
  EnvConfigs envConfigs(@Named("envVars") final Map<String, String> env) {
    return new EnvConfigs(env);
  }

  // This is currently needed for tests bceause the default env is docker
  @Singleton
  @Requires(notEnv = Environment.KUBERNETES)
  ProcessFactory dockerProcessFactory(final WorkerConfigsProvider workerConfigsProvider, final EnvConfigs configs) {
    return new DockerProcessFactory(
        workerConfigsProvider,
        configs.getWorkspaceRoot(), // Path.of(workspaceRoot),
        configs.getWorkspaceDockerMount(), // workspaceDockerMount,
        configs.getLocalDockerMount(), // localDockerMount,
        configs.getDockerNetwork()// dockerNetwork
    );
  }

  @Singleton
  @Requires(env = Environment.KUBERNETES)
  ProcessFactory kubeProcessFactory(
                                    final WorkerConfigsProvider workerConfigsProvider,
                                    final EnvConfigs configs,
                                    @Value("${micronaut.server.port}") final int serverPort,
                                    @Value("${airbyte.worker.job.kube.serviceAccount}") final String serviceAccount)
      throws UnknownHostException {
    final var localIp = InetAddress.getLocalHost().getHostAddress();
    final var kubeHeartbeatUrl = localIp + ":" + serverPort;

    // this needs to have two ports for the source and two ports for the destination (all four must be
    // exposed)
    KubePortManagerSingleton.init(OrchestratorConstants.PORTS);

    return new KubeProcessFactory(
        workerConfigsProvider,
        configs.getJobKubeNamespace(),
        serviceAccount,
        new DefaultKubernetesClient(),
        kubeHeartbeatUrl);
  }

  @Singleton
  JobOrchestrator<?> jobOrchestrator(
                                     @Named("application") final String application,
                                     final EnvConfigs envConfigs,
                                     final ProcessFactory processFactory,
                                     final WorkerConfigsProvider workerConfigsProvider,
                                     final JobRunConfig jobRunConfig,
                                     final ReplicationWorkerFactory replicationWorkerFactory) {
    return switch (application) {
      case ReplicationLauncherWorker.REPLICATION -> new ReplicationJobOrchestrator(envConfigs, jobRunConfig,
          replicationWorkerFactory);
      case NormalizationLauncherWorker.NORMALIZATION -> new NormalizationJobOrchestrator(envConfigs, processFactory, jobRunConfig);
      case DbtLauncherWorker.DBT -> new DbtJobOrchestrator(envConfigs, workerConfigsProvider, processFactory, jobRunConfig);
      case AsyncOrchestratorPodProcess.NO_OP -> new NoOpOrchestrator();
      default -> throw new IllegalStateException("Could not find job orchestrator for application: " + application);
    };
  }

  @Singleton
  DocumentStoreClient documentStoreClient(final EnvConfigs config) {
    return StateClients.create(config.getStateStorageCloudConfigs(), Path.of("/state"));
  }

  @Prototype
  @Named("syncPersistenceExecutorService")
  public ScheduledExecutorService syncPersistenceExecutorService() {
    return Executors.newSingleThreadScheduledExecutor();
  }

  @Singleton
  public StateAggregatorFactory stateAggregatorFactory(final FeatureFlags featureFlags) {
    return new StateAggregatorFactory(featureFlags);
  }

}
