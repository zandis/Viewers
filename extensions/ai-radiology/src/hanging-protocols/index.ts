import { Types } from '@ohif/core';

/**
 * AI Radiology Hanging Protocol Module
 * Defines layout configurations for AI-assisted radiology workflow
 */
const getHangingProtocolModule = (): Types.HangingProtocol[] => {
  return [aiRadiologyProtocol, aiReportSideBySideProtocol, aiMultiViewProtocol];
};

/**
 * Standard AI Radiology Protocol
 * 2x1 layout with image on left, AI report panel on right
 */
const aiRadiologyProtocol: Types.HangingProtocol = {
  id: 'ai-radiology-standard',
  name: 'AI Radiology - Standard',
  description: 'Standard layout for AI-assisted radiology with report panel',
  icon: 'layout-advanced-2x1',
  isPreset: true,

  // Protocol matches any study
  protocolMatchingRules: [],

  // Display set selectors
  displaySetSelectors: {
    primaryDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: 0,
          },
          weight: 1,
        },
      ],
    },
  },

  // Default viewport configuration
  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
    },
    displaySets: [
      {
        id: 'primaryDisplaySet',
        matchedDisplaySetsIndex: 0,
      },
    ],
  },

  // Stages (layouts)
  stages: [
    {
      id: 'ai-radiology-1x1',
      name: 'AI Report View',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 1,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'primaryDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'ai-radiology-2x1',
      name: 'Comparison View',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 2,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'primaryDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'primaryDisplaySet',
              matchedDisplaySetsIndex: 1,
            },
          ],
        },
      ],
    },
  ],

  // Callbacks for panel management
  callbacks: {
    onProtocolEnter: [
      {
        commandName: 'setPanelConfiguration',
        commandOptions: {
          rightPanels: ['ai-report-panel'],
        },
      },
    ],
  },
};

/**
 * AI Report Side-by-Side Protocol
 * Optimized for reviewing AI findings alongside images
 */
const aiReportSideBySideProtocol: Types.HangingProtocol = {
  id: 'ai-report-side-by-side',
  name: 'AI Report - Side by Side',
  description: 'Side-by-side view of images with AI report panel expanded',
  icon: 'layout-advanced-2x1',
  isPreset: true,

  protocolMatchingRules: [],

  displaySetSelectors: {
    axialDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'ImageOrientationPatient',
          constraint: {
            contains: [1, 0, 0, 0, 1, 0], // Axial orientation
          },
          weight: 2,
        },
        {
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: 0,
          },
          weight: 1,
        },
      ],
    },
    sagittalDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'ImageOrientationPatient',
          constraint: {
            contains: [0, 1, 0, 0, 0, -1], // Sagittal orientation
          },
          weight: 2,
        },
      ],
    },
    coronalDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'ImageOrientationPatient',
          constraint: {
            contains: [1, 0, 0, 0, 0, -1], // Coronal orientation
          },
          weight: 2,
        },
      ],
    },
  },

  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
    },
    displaySets: [
      {
        id: 'axialDisplaySet',
        matchedDisplaySetsIndex: 0,
      },
    ],
  },

  stages: [
    {
      id: 'ai-review-single',
      name: 'Single View',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 1,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'axialDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'ai-review-dual',
      name: 'Dual View',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 2,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'axialDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'sagittalDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'ai-review-mpr',
      name: 'MPR View',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 2,
          columns: 2,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'axialDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'sagittalDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'coronalDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'default',
          },
          displaySets: [
            {
              id: 'axialDisplaySet',
              matchedDisplaySetsIndex: 1,
            },
          ],
        },
      ],
    },
  ],

  callbacks: {
    onProtocolEnter: [
      {
        commandName: 'setPanelConfiguration',
        commandOptions: {
          rightPanels: ['ai-report-panel'],
          rightPanelExpanded: true,
        },
      },
    ],
  },
};

/**
 * AI Multi-View Protocol for Chest CT
 * Optimized for lung cancer screening and chest pathology review
 */
const aiMultiViewProtocol: Types.HangingProtocol = {
  id: 'ai-chest-ct-protocol',
  name: 'AI Chest CT',
  description: 'Optimized layout for AI-assisted chest CT review',
  icon: 'layout-advanced-3x2',
  isPreset: true,

  protocolMatchingRules: [
    {
      attribute: 'ModalitiesInStudy',
      constraint: {
        contains: 'CT',
      },
      weight: 1,
    },
    {
      attribute: 'StudyDescription',
      constraint: {
        containsI: 'chest',
      },
      weight: 2,
    },
  ],

  displaySetSelectors: {
    lungWindowDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'SeriesDescription',
          constraint: {
            containsI: 'lung',
          },
          weight: 3,
        },
        {
          attribute: 'Modality',
          constraint: {
            equals: 'CT',
          },
          weight: 1,
        },
      ],
    },
    mediastinalWindowDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'SeriesDescription',
          constraint: {
            containsI: 'mediastin',
          },
          weight: 3,
        },
        {
          attribute: 'Modality',
          constraint: {
            equals: 'CT',
          },
          weight: 1,
        },
      ],
    },
    boneWindowDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'SeriesDescription',
          constraint: {
            containsI: 'bone',
          },
          weight: 3,
        },
      ],
    },
    defaultCTDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'Modality',
          constraint: {
            equals: 'CT',
          },
          weight: 1,
        },
        {
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: 10,
          },
          weight: 2,
        },
      ],
    },
  },

  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'ct-default',
      displayArea: {
        type: 'FIT',
      },
    },
    displaySets: [
      {
        id: 'defaultCTDisplaySet',
        matchedDisplaySetsIndex: 0,
      },
    ],
  },

  stages: [
    {
      id: 'chest-single',
      name: 'Single View',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 1,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'ct-default',
            initialImageOptions: {
              preset: 'middle',
            },
          },
          displaySets: [
            {
              id: 'lungWindowDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'chest-dual-window',
      name: 'Dual Window',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 2,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'ct-default',
            // Lung window
            customViewportProps: {
              windowCenter: -600,
              windowWidth: 1500,
            },
          },
          displaySets: [
            {
              id: 'defaultCTDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'ct-default',
            // Mediastinal window
            customViewportProps: {
              windowCenter: 40,
              windowWidth: 400,
            },
          },
          displaySets: [
            {
              id: 'defaultCTDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
      ],
    },
    {
      id: 'chest-triple-window',
      name: 'Triple Window',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 1,
          columns: 3,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'ct-default',
            customViewportProps: {
              windowCenter: -600,
              windowWidth: 1500,
            },
          },
          displaySets: [
            {
              id: 'defaultCTDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'ct-default',
            customViewportProps: {
              windowCenter: 40,
              windowWidth: 400,
            },
          },
          displaySets: [
            {
              id: 'defaultCTDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
        {
          viewportOptions: {
            viewportType: 'stack',
            toolGroupId: 'ct-default',
            customViewportProps: {
              windowCenter: 400,
              windowWidth: 2000,
            },
          },
          displaySets: [
            {
              id: 'defaultCTDisplaySet',
              matchedDisplaySetsIndex: 0,
            },
          ],
        },
      ],
    },
  ],

  callbacks: {
    onProtocolEnter: [
      {
        commandName: 'setPanelConfiguration',
        commandOptions: {
          rightPanels: ['ai-report-panel'],
          leftPanels: ['seriesList'],
        },
      },
    ],
  },
};

export default getHangingProtocolModule;
