import { faCircleQuestion } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import classNames from "classnames";
import { useMemo, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { FlexContainer } from "components/ui/Flex";
import { Heading } from "components/ui/Heading";
import { Link } from "components/ui/Link";
import { Text } from "components/ui/Text";
import { Tooltip } from "components/ui/Tooltip";

import { useCurrentWorkspace } from "core/api";
import { DestinationDefinitionRead, SourceDefinitionRead } from "core/request/AirbyteClient";
import { useAvailableDestinationDefinitions } from "hooks/domain/connector/useAvailableDestinationDefinitions";
import { useAvailableSourceDefinitions } from "hooks/domain/connector/useAvailableSourceDefinitions";
import { useExperiment } from "hooks/services/Experiment";
import { ConnectionRoutePaths, RoutePaths } from "pages/routePaths";
import { ConnectorIds } from "utils/connectors";
import { getIcon } from "utils/imageUtils";
import { links } from "utils/links";

import { AirbyteIllustration, HighlightIndex } from "./AirbyteIllustration";
import styles from "./ConnectionOnboarding.module.scss";
import { ReactComponent as PlusIcon } from "./plusIcon.svg";
import { SOURCE_DEFINITION_PARAM } from "../CreateConnection/CreateNewSource";
import { NEW_SOURCE_TYPE, SOURCE_TYPE_PARAM } from "../CreateConnection/SelectSource";

interface ConnectionOnboardingProps {
  onCreate: (sourceConnectorTypeId?: string) => void;
}

const DEFAULT_SOURCES = [
  ConnectorIds.Sources.FacebookMarketing,
  ConnectorIds.Sources.Postgres,
  ConnectorIds.Sources.GoogleSheets,
];

const DEFAULT_DESTINATIONS = [
  ConnectorIds.Destinations.BigQuery,
  ConnectorIds.Destinations.Snowflake,
  ConnectorIds.Destinations.Postgres,
];

interface ConnectorSpecificationMap {
  sourceDefinitions: Record<string, SourceDefinitionRead>;
  destinationDefinitions: Record<string, DestinationDefinitionRead>;
}

const roundConnectorCount = (connectors: Record<string, SourceDefinitionRead | DestinationDefinitionRead>): number => {
  return Math.floor(Object.keys(connectors).length / 10) * 10;
};

/**
 * Gets all available connectors, filter out the ones that should not get new
 * connections (via the {@code useAvailableConnectorDefintions} hook) and convert
 * them to a map by id, to access them faster.
 */
export const useConnectorSpecificationMap = (): ConnectorSpecificationMap => {
  const sourceDefinitionsList = useAvailableSourceDefinitions();
  const destinationDefinitionsList = useAvailableDestinationDefinitions();

  const sourceDefinitions = useMemo(
    () =>
      sourceDefinitionsList.reduce<Record<string, SourceDefinitionRead>>((map, def) => {
        map[def.sourceDefinitionId] = def;
        return map;
      }, {}),
    [sourceDefinitionsList]
  );

  const destinationDefinitions = useMemo(
    () =>
      destinationDefinitionsList.reduce<Record<string, DestinationDefinitionRead>>((map, def) => {
        map[def.destinationDefinitionId] = def;
        return map;
      }, {}),
    [destinationDefinitionsList]
  );

  return { sourceDefinitions, destinationDefinitions };
};

export const ConnectionOnboarding: React.FC<ConnectionOnboardingProps> = () => {
  const { formatMessage } = useIntl();
  const { workspaceId } = useCurrentWorkspace();
  const { sourceDefinitions, destinationDefinitions } = useConnectorSpecificationMap();

  const [highlightedSource, setHighlightedSource] = useState<HighlightIndex>(1);
  const [highlightedDestination, setHighlightedDestination] = useState<HighlightIndex>(0);

  const sourceIds = useExperiment("connection.onboarding.sources", "").split(",");
  const destinationIds = useExperiment("connection.onboarding.destinations", "").split(",");

  const createConnectionPath = `/${RoutePaths.Workspaces}/${workspaceId}/${RoutePaths.Connections}/${ConnectionRoutePaths.ConnectionNew}`;

  const createSourcePath = (sourceDefinitionId?: string) => {
    const sourceDefinitionPath = sourceDefinitionId ? `&${SOURCE_DEFINITION_PARAM}=${sourceDefinitionId}` : "";

    return `${createConnectionPath}?${SOURCE_TYPE_PARAM}=${NEW_SOURCE_TYPE}${sourceDefinitionPath}`;
  };

  const sources = useMemo(
    () =>
      DEFAULT_SOURCES.map(
        (defaultId, index) => sourceDefinitions[sourceIds[index] || defaultId] ?? sourceDefinitions[defaultId]
      ),
    [sourceDefinitions, sourceIds]
  );

  const destinations = useMemo(
    () =>
      DEFAULT_DESTINATIONS.map(
        (defaultId, index) =>
          destinationDefinitions[destinationIds[index] || defaultId] ?? destinationDefinitions[defaultId]
      ),
    [destinationDefinitions, destinationIds]
  );

  const moreSourcesTooltip = formatMessage(
    { id: "connection.onboarding.moreSources" },
    { count: roundConnectorCount(sourceDefinitions) }
  );

  const moreDestinationsTooltip = formatMessage(
    { id: "connection.onboarding.moreDestinations" },
    { count: roundConnectorCount(destinationDefinitions) }
  );

  return (
    <div className={styles.container}>
      <Heading as="h2" size="lg" centered className={styles.heading}>
        <FormattedMessage id="connection.onboarding.title" />
      </Heading>
      <div className={styles.connectors}>
        <div className={styles.sources}>
          <Text bold as="div" className={styles.sourcesTitle}>
            <Tooltip
              control={
                <span>
                  <FormattedMessage id="connection.onboarding.sources" /> <FontAwesomeIcon icon={faCircleQuestion} />
                </span>
              }
            >
              <FormattedMessage id="connection.onboarding.sourcesDescription" />
            </Tooltip>
          </Text>
          {sources.map((source, index) => {
            const tooltipText = formatMessage({ id: "connection.onboarding.addSource" }, { source: source?.name });
            return (
              <Tooltip
                key={source?.sourceDefinitionId}
                placement="right"
                control={
                  <Link
                    data-testid={`onboardingSource-${index}`}
                    data-source-definition-id={source?.sourceDefinitionId}
                    aria-label={tooltipText}
                    to={createSourcePath(source?.sourceDefinitionId)}
                  >
                    <FlexContainer
                      className={styles.connectorButton}
                      onMouseEnter={() => setHighlightedSource(index as HighlightIndex)}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <div className={styles.connectorIcon}>{getIcon(source?.icon)}</div>
                    </FlexContainer>
                  </Link>
                }
              >
                {tooltipText}
              </Tooltip>
            );
          })}

          <Tooltip
            placement="right"
            control={
              <Link data-testid="onboardingSource-more" to={createSourcePath()} aria-label={moreSourcesTooltip}>
                <FlexContainer
                  onMouseEnter={() => setHighlightedSource(3)}
                  className={styles.connectorButton}
                  alignItems="center"
                  justifyContent="center"
                >
                  <PlusIcon className={styles.moreIcon} />
                </FlexContainer>
              </Link>
            }
          >
            {moreSourcesTooltip}
          </Tooltip>
        </div>
        <div className={styles.airbyte} aria-hidden="true">
          <AirbyteIllustration sourceHighlighted={highlightedSource} destinationHighlighted={highlightedDestination} />
        </div>
        <div className={styles.destinations}>
          <Text bold as="div" className={styles.destinationsTitle}>
            <Tooltip
              control={
                <span>
                  <FormattedMessage id="connection.onboarding.destinations" />{" "}
                  <FontAwesomeIcon icon={faCircleQuestion} />
                </span>
              }
            >
              <FormattedMessage id="connection.onboarding.destinationsDescription" />
            </Tooltip>
          </Text>
          {destinations.map((destination, index) => {
            const tooltipText = formatMessage(
              { id: "connection.onboarding.addDestination" },
              { destination: destination?.name }
            );
            return (
              <Tooltip
                key={destination?.destinationDefinitionId}
                placement="right"
                control={
                  <button
                    className={styles.connectorButton}
                    // onMouseEnter doesn't trigger on disabled buttons in React
                    // https://github.com/facebook/react/issues/10109
                    // Thus we just disable it via aria-disabled and make it non focusable via tabindex
                    onMouseEnter={() => setHighlightedDestination(index as HighlightIndex)}
                    aria-disabled="true"
                    aria-label={tooltipText}
                    tabIndex={-1}
                  >
                    <div className={styles.connectorIcon}>{getIcon(destination?.icon)}</div>
                  </button>
                }
              >
                {tooltipText}
              </Tooltip>
            );
          })}
          <Tooltip
            placement="right"
            control={
              <button
                className={styles.connectorButton}
                // onMouseEnter doesn't trigger on disabled buttons in React
                // https://github.com/facebook/react/issues/10109
                // Thus we just disable it via aria-disabled and make it non focusable via tabindex
                onMouseEnter={() => setHighlightedDestination(3)}
                aria-disabled="true"
                aria-label={moreDestinationsTooltip}
                tabIndex={-1}
              >
                <PlusIcon className={styles.moreIcon} />
              </button>
            }
          >
            {moreDestinationsTooltip}
          </Tooltip>
        </div>
      </div>
      <div className={styles.footer}>
        <Link
          to={createConnectionPath}
          data-testid="new-connection-button"
          className={classNames(styles.button, styles.typePrimary, styles.sizeL, styles.linkText)}
        >
          <FormattedMessage id="connection.onboarding.createFirst" />
        </Link>
        <FormattedMessage
          tagName="span"
          id="connection.onboarding.demoInstance"
          values={{
            demoLnk: (children: React.ReactNode) => (
              <a href={links.demoLink} target="_blank" rel="noreferrer noopener" className={styles.demoLink}>
                {children}
              </a>
            ),
          }}
        />
      </div>
    </div>
  );
};
