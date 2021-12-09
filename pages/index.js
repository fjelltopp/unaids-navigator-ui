import React, { useState, useEffect } from 'react';
import { useRouter } from "next/router";
import {
  Row, Col, ButtonToolbar, ListGroup, ProgressBar, Alert
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Layout } from '../components/Layout'
import DatasetSelector from '../components/DatasetSelector';
import LogsComponent from '../components/LogsComponent';
import LoadingBanner from '../components/LoadingBanner';
import ErrorPagePopup from '../components/ErrorPagePopup';
import MilestonesSidebar from '../components/MilestonesSidebar';
import {
  TaskCompleteCheckbox, MainThreeActionButtons
} from '../components/ActionButtons';
import { makeUseAxios } from 'axios-hooks'
import {
  baseAxiosConfig, getWorkflow, getWorkflowTask,
  taskSkipRequest, taskCompleteRequest, taskCompleteDeleteRequest
} from '../lib/api';
import { getWorkflowStats } from '../lib/actionButtons';
import { actions } from '../lib/actionButtons';

const useAxios = makeUseAxios(baseAxiosConfig)

export default function IndexPage(props) {
  const router = useRouter();
  const { redirectToTaskId } = router.query;

  const [showDebugData, setshowDebugData] = useState(false);
  const [workflow, setWorkflow] = useState();
  const [alertText, setAlertText] = useState(false);
  const [alertVariant, setAlertVariant] = useState(false)

  const [{ loading, error: apiError }, makeApiRequest] = useAxios(
    null, { manual: true }
  );
  function fetchWorkflow() {
    makeApiRequest(
      getWorkflow(props.currentDatasetId)
    ).then(res => setWorkflow(res.data))
    .catch(() => flashError("Failed to get workflow details."))
  }
  function updateWorkflowTask(newTaskId) {
    makeApiRequest(
      getWorkflowTask(
        props.currentDatasetId,
        newTaskId
      )
    ).then(({ data }) => {
      let updatedWorkflow = { ...workflow };
      updatedWorkflow.currentTask = { ...data };
      setWorkflow(updatedWorkflow);
    })
  }

  function flashError(message) {
    setAlertVariant('danger')
    setAlertText(message)
    console.error(message)
  }

  function clearAlert() {
    setAlertVariant(undefined)
    setAlertText(undefined)
  }

  useEffect(() => {
    fetchWorkflow();
  }, [props.currentDatasetId]);

  useEffect(() => {
    if (workflow && redirectToTaskId) {
      updateWorkflowTask(redirectToTaskId);
      router.push('/', undefined, { shallow: true });
    }
  }, [workflow]);

  function carryOutActions(actionToCarryOut) {
    clearAlert()
    const updateWorkflowComplete = (complete, postToApi) => {
      function updateLocalState() {
        let updatedWorkflow = { ...workflow };
        updatedWorkflow.currentTask.completed = complete;
        setWorkflow(updatedWorkflow)
      }
      if (postToApi) {
        const apiRequest = complete
          ? taskCompleteRequest
          : taskCompleteDeleteRequest
        makeApiRequest(
          apiRequest(
            props.currentDatasetId,
            workflow.currentTask.id
          )
        )
        .then(() => updateLocalState())
        .catch(() => flashError("Failed to mark the task as completed."))
      } else {
        updateLocalState();
      }
    }
    if (actionToCarryOut === actions.markTaskAsComplete) {
      updateWorkflowComplete(true, true);
    } else if (actionToCarryOut === actions.markTaskAsIncomplete) {
      updateWorkflowComplete(false, true);
    } else if ([
      actions.getPreviousTask,
      actions.getNextTask
    ].includes(actionToCarryOut)) {
      const taskBreadcrumbs = workflow.taskBreadcrumbs;
      const indexOfCurrentTask = taskBreadcrumbs.indexOf(workflow.currentTask.id);
      const newTaskId = actionToCarryOut === actions.getPreviousTask
        ? taskBreadcrumbs[indexOfCurrentTask - 1]
        : taskBreadcrumbs[indexOfCurrentTask + 1]
      updateWorkflowTask(newTaskId);
    } else if (actionToCarryOut === actions.skipTaskAndFetchLatestWorkflowState) {
      makeApiRequest(
        taskSkipRequest(
          props.currentDatasetId,
          workflow.currentTask.id
        )
      ).then(() => fetchWorkflow());
    } else if (actionToCarryOut === actions.fetchLatestWorkflowState) {
      fetchWorkflow();
    } else if (actionToCarryOut === actions.toggleCompleteStateLocally) {
      updateWorkflowComplete(!workflow.currentTask.completed, false);
    } else {
      throw new Error([`Unknown action: ${actionToCarryOut}`])
    }
  }

  function MainPageContent({ workflow }) {
    const { isLatestTask } = getWorkflowStats(workflow)

    function HelpUrlsComponent({ helpUrls }) {
      return (
        <Row id="HelpUrlsComponent">
          <Col md={9}>
            <ListGroup variant="flush">
              {helpUrls.map((action, index) =>
                <ListGroup.Item
                  key={index}
                  action
                  variant="light"
                  className="text-danger bg-white"
                  href={action.url}
                  target="_blank"
                >
                  <Row>
                    <Col xs={1}><FontAwesomeIcon icon={faLink} className="me-2" /></Col>
                    <Col>{action.label}</Col>
                  </Row>
                </ListGroup.Item>
              )}
            </ListGroup>
          </Col>
        </Row>
      )
    }

    return (
      <>
        <ProgressBar className="mt-2">
          <ProgressBar variant="danger" now={workflow.progress || 1} />
        </ProgressBar>
        <br />
        <Row>
          <Col md={3}>
            <MilestonesSidebar
              milestones={workflow.milestones}
              currentMilestoneId={workflow.currentTask.milestoneID}
              milestoneListFullyResolved={workflow.milestoneListFullyResolved}
            />
          </Col>
          <Col className="border-start">
            {workflow.message && isLatestTask && (
              <Alert variant={workflow.message.level}>{workflow.message.text}</Alert>
            )}
            {alertText && (
              <Alert variant={alertVariant}>{alertText}</Alert>
            )}
            <h4>{workflow.currentTask.details.title}</h4>
            <br />
            <div dangerouslySetInnerHTML={{ __html: workflow.currentTask.details.displayHTML }}></div>
            <Row>
              <Col xs={9}>
                {workflow.currentTask.details.helpURLs &&
                  <>
                    <br />
                    <HelpUrlsComponent helpUrls={workflow.currentTask.details.helpURLs} />
                  </>
                }
              </Col>
              <Col xs={3} className="d-flex align-items-end flex-column">
                <div className="mt-auto">
                  <TaskCompleteCheckbox
                    workflow={{ currentTask: workflow.currentTask, taskBreadcrumbs: workflow.taskBreadcrumbs }}
                    handleClick={carryOutActions}
                    showDebugData={showDebugData}
                  />
                </div>
              </Col>
            </Row>
            <hr />
            <Row>
              <Col>
                <div id="WorkflowAndTaskIds">
                  <div>Workflow {workflow.id}</div>
                  <div>Task {workflow.currentTask.id}</div>
                  <div>
                    <a onClick={() => setshowDebugData(!showDebugData)}>Debug Mode</a>
                  </div>
                </div>
              </Col>
              <Col>
                <ButtonToolbar className="justify-content-end">
                  <MainThreeActionButtons
                    workflow={{ currentTask: workflow.currentTask, taskBreadcrumbs: workflow.taskBreadcrumbs }}
                    handleClick={carryOutActions}
                    showDebugData={showDebugData}
                  />
                </ButtonToolbar>
              </Col>
            </Row>
          </Col>
        </Row>
      </>
    )

  }

  return (
    <Layout>
      <DatasetSelector
        currentDatasetId={props.currentDatasetId}
        setCurrentDatasetId={props.setCurrentDatasetId}
        datasets={props.user.datasets}
      />
      {workflow && workflow.id && !loading &&
        <MainPageContent {...{ workflow }} />
      }
      {(loading || redirectToTaskId) && <LoadingBanner />}
      {showDebugData && (
        <LogsComponent objects={[
          { title: 'workflow', data: workflow },
          { title: 'props', data: props }
        ]} />
      )}
    </Layout>
  )

}
