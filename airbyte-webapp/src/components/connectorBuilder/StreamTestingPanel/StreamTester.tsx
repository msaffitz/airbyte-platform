import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FormattedMessage, useIntl } from "react-intl";
import { useLocalStorage } from "react-use";

import { Message } from "components/ui/Message";
import { ResizablePanels } from "components/ui/ResizablePanels";
import { Spinner } from "components/ui/Spinner";
import { Text } from "components/ui/Text";

import { StreamsListReadStreamsItem } from "core/api/types/ConnectorBuilderClient";
import { Action, Namespace } from "core/services/analytics";
import { useAnalyticsService } from "core/services/analytics";
import {
  useConnectorBuilderTestRead,
  useConnectorBuilderFormState,
} from "services/connectorBuilder/ConnectorBuilderStateService";
import { links } from "utils/links";

import { LogsDisplay } from "./LogsDisplay";
import { ResultDisplay } from "./ResultDisplay";
import { StreamTestButton } from "./StreamTestButton";
import styles from "./StreamTester.module.scss";
import { useTestWarnings } from "./useTestWarnings";
import { formatJson } from "../utils";

export const StreamTester: React.FC<{
  hasTestInputJsonErrors: boolean;
  setTestInputOpen: (open: boolean) => void;
}> = ({ hasTestInputJsonErrors, setTestInputOpen }) => {
  const { formatMessage } = useIntl();
  const {
    streams,
    testStreamIndex,
    isFetchingStreamList,
    streamListErrorMessage,
    streamRead: {
      data: streamReadData,
      refetch: readStream,
      isError,
      error,
      isFetching,
      isFetchedAfterMount,
      dataUpdatedAt,
      errorUpdatedAt,
    },
  } = useConnectorBuilderTestRead();
  const [showLimitWarning, setShowLimitWarning] = useLocalStorage<boolean>("connectorBuilderLimitWarning", true);
  const {
    editorView,
    builderFormValues: { streams: builderFormStreams },
  } = useConnectorBuilderFormState();
  const { setValue } = useFormContext();

  const streamName = streams[testStreamIndex]?.name;

  const analyticsService = useAnalyticsService();

  const [logsFlex, setLogsFlex] = useState(0);
  const handleLogsTitleClick = () => {
    // expand to 50% if it is currently minimized, otherwise minimize it
    setLogsFlex((prevFlex) => (prevFlex < 0.06 ? 0.5 : 0));
  };

  const unknownErrorMessage = formatMessage({ id: "connectorBuilder.unknownError" });
  const errorMessage = isError
    ? error instanceof Error
      ? error.message || unknownErrorMessage
      : unknownErrorMessage
    : undefined;

  const logContainsError = streamReadData?.logs.some((log) => log.level === "ERROR" || log.level === "FATAL");

  useEffect(() => {
    if (isError || logContainsError) {
      setLogsFlex(1);
    } else {
      setLogsFlex(0);
    }
  }, [isError, logContainsError]);

  useEffect(() => {
    // This will only be true if the data was manually refetched by the user clicking the Test button,
    // so the analytics events won't fire just from the user switching between streams, as desired
    if (isFetchedAfterMount) {
      if (errorMessage) {
        analyticsService.track(Namespace.CONNECTOR_BUILDER, Action.STREAM_TEST_FAILURE, {
          actionDescription: "Stream test failed",
          stream_name: streamName,
          error_message: errorMessage,
        });
      } else {
        analyticsService.track(Namespace.CONNECTOR_BUILDER, Action.STREAM_TEST_SUCCESS, {
          actionDescription: "Stream test succeeded",
          stream_name: streamName,
        });
      }
    }
  }, [analyticsService, errorMessage, isFetchedAfterMount, streamName, dataUpdatedAt, errorUpdatedAt]);

  const autoImportSchema = builderFormStreams[testStreamIndex]?.autoImportSchema;
  useEffect(() => {
    if (editorView === "ui" && autoImportSchema && streamReadData?.inferred_schema) {
      setValue(`streams.${testStreamIndex}.schema`, formatJson(streamReadData.inferred_schema, true), {
        shouldValidate: true,
        shouldTouch: true,
        shouldDirty: true,
      });
    }
  }, [editorView, autoImportSchema, testStreamIndex, streamReadData?.inferred_schema, setValue]);

  const testDataWarnings = useTestWarnings();

  const currentStream = streams[testStreamIndex] as StreamsListReadStreamsItem | undefined;
  return (
    <div className={styles.container}>
      {currentStream && (
        <Text size="lg" align="center" className={styles.url}>
          {currentStream.url}
        </Text>
      )}
      {!currentStream && isFetchingStreamList && (
        <Text size="lg" align="center">
          <FormattedMessage id="connectorBuilder.loadingStreamList" />
        </Text>
      )}
      {!currentStream && streamListErrorMessage && (
        <Text size="lg" align="center">
          <FormattedMessage id="connectorBuilder.streamListUrlError" />
        </Text>
      )}

      <StreamTestButton
        readStream={() => {
          readStream();
          analyticsService.track(Namespace.CONNECTOR_BUILDER, Action.STREAM_TEST, {
            actionDescription: "Stream test initiated",
            stream_name: streamName,
          });
        }}
        isFetchingStreamList={isFetchingStreamList}
        hasTestInputJsonErrors={hasTestInputJsonErrors}
        hasStreamListErrors={Boolean(streamListErrorMessage)}
        setTestInputOpen={setTestInputOpen}
      />

      {streamListErrorMessage !== undefined && (
        <div className={styles.listErrorDisplay}>
          <Text>
            <FormattedMessage id="connectorBuilder.couldNotDetectStreams" />
          </Text>
          <Text bold>{streamListErrorMessage}</Text>
          <Text>
            <FormattedMessage
              id="connectorBuilder.ensureProperYaml"
              values={{
                a: (node: React.ReactNode) => (
                  <a href={links.lowCodeYamlDescription} target="_blank" rel="noreferrer">
                    {node}
                  </a>
                ),
              }}
            />
          </Text>
        </div>
      )}
      {isFetching && (
        <div className={styles.fetchingSpinner}>
          <Spinner />
        </div>
      )}
      {!isFetching && streamReadData && streamReadData.test_read_limit_reached && showLimitWarning && (
        <Message
          type="warning"
          text={<FormattedMessage id="connectorBuilder.streamTestLimitReached" />}
          onClose={() => {
            setShowLimitWarning(false);
          }}
        />
      )}
      {!isFetching && testDataWarnings.map((warning, index) => <Message type="warning" text={warning} key={index} />)}
      {!isFetching && (streamReadData !== undefined || errorMessage !== undefined) && (
        <ResizablePanels
          className={styles.resizablePanelsContainer}
          orientation="horizontal"
          firstPanel={{
            children: (
              <>
                {streamReadData !== undefined && !isError && (
                  <ResultDisplay slices={streamReadData.slices} inferredSchema={streamReadData.inferred_schema} />
                )}
              </>
            ),
            minWidth: 80,
          }}
          secondPanel={{
            className: styles.logsContainer,
            children: (
              <LogsDisplay logs={streamReadData?.logs ?? []} error={errorMessage} onTitleClick={handleLogsTitleClick} />
            ),
            minWidth: 30,
            flex: logsFlex,
            onStopResize: (newFlex) => {
              if (newFlex) {
                setLogsFlex(newFlex);
              }
            },
          }}
        />
      )}
    </div>
  );
};
