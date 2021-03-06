import React, { memo, useCallback, useEffect } from 'react';
import ReactGA from 'react-ga';
import { Option } from 'react-select';

import { Illustration } from '@spinnaker/presentation';

import {
  IModalComponentProps,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ReactSelectInput,
  FormikFormField,
  TextAreaInput,
  showModal,
  SpinFormik,
  ValidationMessage,
} from '../../presentation';
import { HelpField } from '../../help';
import { IManagedArtifactVersion, IManagedResourceSummary } from '../../domain';
import { Application } from '../../application';

import { ManagedWriter } from '../ManagedWriter';
import { Button } from '../Button';
import { EnvironmentBadge } from '../EnvironmentBadge';

import { getArtifactVersionDisplayName } from '../displayNames';
import { useEnvironmentTypeFromResources } from '../useEnvironmentTypeFromResources.hooks';

const MARK_BAD_DOCS_URL = 'https://www.spinnaker.io/guides/user/managed-delivery/marking-as-bad/';

const logEvent = (label: string, application: string, environment?: string, reference?: string) =>
  ReactGA.event({
    category: 'Environments - mark version as bad modal',
    action: label,
    label: environment ? `${application}:${environment}:${reference}` : application,
  });

type IEnvironmentOptionProps = Option<string> & { disabledReason: string; allResources: IManagedResourceSummary[] };

const EnvironmentOption = memo(({ label, disabled, disabledReason, allResources }: IEnvironmentOptionProps) => {
  const isCritical = useEnvironmentTypeFromResources(allResources);

  return (
    <span>
      <span className="sp-margin-s-right" style={{ opacity: disabled ? 0.66 : 1 }}>
        <EnvironmentBadge name={label} critical={isCritical} size="extraSmall" />
      </span>
      {disabled && (
        <span className="small" style={{ fontStyle: 'italic', color: '#666' }}>
          Already {disabledReason} here
        </span>
      )}
    </span>
  );
});

export interface IMarkArtifactAsBadModalProps extends IModalComponentProps {
  application: Application;
  reference: string;
  version: IManagedArtifactVersion;
  resourcesByEnvironment: { [environment: string]: IManagedResourceSummary[] };
}

export const showMarkArtifactAsBadModal = (props: IMarkArtifactAsBadModalProps) =>
  showModal(MarkArtifactAsBadModal, props, { maxWidth: 750 }).then((result) => {
    if (result.status === 'DISMISSED') {
      logEvent('Modal dismissed', props.application.name);
    }
    return result;
  });

export const MarkArtifactAsBadModal = memo(
  ({
    application,
    reference,
    version,
    resourcesByEnvironment,
    dismissModal,
    closeModal,
  }: IMarkArtifactAsBadModalProps) => {
    const optionRenderer = useCallback(
      (option: Option<string> & { disabledReason: string }) => (
        <EnvironmentOption {...option} allResources={resourcesByEnvironment[option.value]} />
      ),
      [resourcesByEnvironment],
    );

    useEffect(() => logEvent('Modal seen', application.name), []);

    return (
      <>
        <ModalHeader>Mark {getArtifactVersionDisplayName(version)} as bad</ModalHeader>
        <SpinFormik<{
          environment: string;
          comment?: string;
        }>
          initialValues={{
            environment: version.environments.find(({ pinned, state }) => !pinned && state !== 'vetoed').name,
          }}
          onSubmit={({ environment, comment }, { setSubmitting, setStatus }) =>
            ManagedWriter.markArtifactVersionAsBad({
              environment,
              reference,
              comment,
              application: application.name,
              version: version.version,
            })
              .then(() => {
                logEvent('Version marked bad', application.name, environment, reference);
                closeModal();
              })
              .catch((error: { data: { error: string; message: string } }) => {
                setSubmitting(false);
                setStatus({ error: error.data });
                logEvent('Error marking version bad', application.name, environment, reference);
              })
          }
          render={({ status, isValid, isSubmitting, submitForm }) => {
            const errorTitle = status?.error?.error;
            const errorMessage = status?.error?.message;

            return (
              <>
                <ModalBody>
                  <div className="flex-container-v middle sp-padding-xl-yaxis">
                    <div className="flex-container-h middle sp-margin-xl-bottom">
                      <span className="sp-margin-m-right" style={{ minWidth: 145 }}>
                        <Illustration name="markArtifactVersionAsBad" />
                      </span>
                      <span>
                        <p>
                          If you mark a version as bad in an environment, Spinnaker will never deploy it there. If the
                          version is already deployed there, Spinnaker will immediately replace it with the latest good
                          version approved for deployment.
                        </p>{' '}
                        <a
                          target="_blank"
                          onClick={() => logEvent('Mark as bad docs link clicked', application.name)}
                          href={MARK_BAD_DOCS_URL}
                        >
                          Check out our documentation
                        </a>{' '}
                        for more information.
                      </span>
                    </div>
                    <FormikFormField
                      name="environment"
                      label="Environment"
                      input={(props) => (
                        <ReactSelectInput
                          {...props}
                          options={version.environments.map(({ name, pinned, state }) => ({
                            label: name,
                            value: name,
                            disabled: !!pinned || state === 'vetoed',
                            disabledReason: !!pinned ? 'pinned' : 'marked as bad',
                          }))}
                          optionRenderer={optionRenderer}
                          valueRenderer={optionRenderer}
                          searchable={false}
                          clearable={false}
                        />
                      )}
                    />
                    <FormikFormField
                      label="Reason"
                      name="comment"
                      required={true}
                      input={(props) => <TextAreaInput {...props} rows={5} required={true} />}
                    />
                    <div className="small text-right">
                      Markdown is okay <HelpField id="markdown.examples" />
                    </div>

                    {status?.error && (
                      <div className="sp-margin-xl-top">
                        <ValidationMessage
                          type="error"
                          message={
                            <span className="flex-container-v">
                              <span className="text-bold">Something went wrong:</span>
                              {errorTitle && <span className="text-semibold">{errorTitle}</span>}
                              {errorMessage && <span>{errorMessage}</span>}
                            </span>
                          }
                        />
                      </div>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter
                  primaryActions={
                    <div className="flex-container-h sp-group-margin-s-xaxis">
                      <Button onClick={() => dismissModal()}>Cancel</Button>
                      <Button appearance="primary" disabled={!isValid || isSubmitting} onClick={() => submitForm()}>
                        Mark as bad
                      </Button>
                    </div>
                  }
                />
              </>
            );
          }}
        />
      </>
    );
  },
);
