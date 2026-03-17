import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface TutorialStep {
  id: string;
  target?: string; // data-tutorial attribute value
  title: string;
  body: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Mix Bridge',
    body: "Let's explore with a demo session. You'll see how to build a stem queue, set the range, pick your output, and run bounces. Connect to Pro Tools when you're ready for real bounces.",
  },
  {
    id: 'connect',
    target: 'connect',
    title: 'Connection Status',
    body: 'The status bar shows your session name when connected. In this demo it shows "Demo Session". With Pro Tools open, you\'ll see your real session here.',
  },
  {
    id: 'sessions',
    target: 'sessions',
    title: 'Sessions',
    body: 'Add Pro Tools sessions to your batch. Each session has its own queue and settings. Use + to pick .ptx files, or add the session currently open in Pro Tools.',
  },
  {
    id: 'build-stems',
    target: 'build-stems',
    title: 'Build Stems',
    body: 'Add bounces to your queue: use Batch (selected tracks), Solo (soloed tracks), or Mute (muted tracks). Each creates a stem bounce. You can add multiple and reorder them.',
  },
  {
    id: 'rename-stems',
    target: 'rename-stems',
    title: 'Rename Stems',
    body: 'Click on any stem name to edit it. Customize output file names before bouncing — useful for versioning or client deliverables.',
  },
  {
    id: 'set-range',
    target: 'range',
    title: 'Set Range',
    body: 'Capture the bounce range from your timeline or from In/Out markers. Click "Get Timeline" to use the current selection, or pick markers for precise boundaries.',
  },
  {
    id: 'routing',
    target: 'routing',
    title: 'Routing & Format',
    body: 'Select a mix output as the bounce destination. Choose your format (WAV, MP3, etc.) and sample rate. The output folder defaults to your session folder.',
  },
  {
    id: 'run',
    target: 'run',
    title: 'Run',
    body: 'When your queue is ready, click Run to bounce all stems. In this demo, bounces are simulated — connect to Pro Tools for real bounces.',
  },
  {
    id: 'delete-demo',
    target: 'remove-session',
    title: 'Get Started',
    body: 'Remove the Demo Session to add your own. Right-click the session and choose Remove, or use the + button to add your Pro Tools sessions.',
  },
  {
    id: 'done',
    title: "You're all set!",
    body: "You now know the basics. Build your queue, set the range, pick your output, and run. Check Settings for shortcuts and more options. Happy bouncing!",
  },
];

interface TutorialContextValue {
  active: boolean;
  stepIndex: number;
  step: TutorialStep | null;
  simulateMode: boolean;
  /** For display when simulateMode: true when simulating, else real connected */
  displayConnected: boolean;
  /** For display when simulateMode: 'Demo Session', else real sessionName */
  displaySessionName: string | null;
  next: () => void;
  skip: () => void;
  startTutorial: () => void;
  setSimulateMode: (v: boolean) => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

const STORAGE_KEY = 'mix-bridge-tutorial-completed';

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}

interface TutorialProviderProps {
  children: React.ReactNode;
  autoStart: boolean;
  /** Real connection state; used to compute displayConnected/displaySessionName */
  connected?: boolean;
  sessionName?: string | null;
  /** Called when tutorial starts — populate demo data. forTutorial=true uses empty queue. */
  onSimulateMode?: (options?: { forTutorial?: boolean }) => void;
  /** Called when build-stems step is reached — add demo stems progressively. */
  onBuildStemsStepReached?: () => void;
}

export function TutorialProvider({ children, autoStart, connected = false, sessionName = null, onSimulateMode, onBuildStemsStepReached }: TutorialProviderProps) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [simulateMode, setSimulateModeState] = useState(false);

  const setSimulateMode = useCallback((v: boolean) => {
    setSimulateModeState(v);
    if (v) onSimulateMode?.();
  }, [onSimulateMode]);

  const startTutorial = useCallback(() => {
    setTutorialCompleted(false);
    setActive(true);
    setStepIndex(0);
    setSimulateModeState(true);
    onSimulateMode?.({ forTutorial: true });
  }, [onSimulateMode]);

  const finish = useCallback(() => {
    setActive(false);
    setTutorialCompleted(true);
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, finish]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  useEffect(() => {
    if (autoStart && !getTutorialCompleted() && !active) {
      const timer = setTimeout(startTutorial, 500);
      return () => clearTimeout(timer);
    }
  }, [autoStart, active, startTutorial]);

  const step = TUTORIAL_STEPS[stepIndex] ?? null;

  const buildStemsCalledRef = React.useRef(false);
  useEffect(() => {
    if (stepIndex === 0) buildStemsCalledRef.current = false;
  }, [stepIndex]);
  useEffect(() => {
    if (step?.id === 'build-stems' && onBuildStemsStepReached && !buildStemsCalledRef.current) {
      buildStemsCalledRef.current = true;
      onBuildStemsStepReached();
    }
  }, [step?.id, onBuildStemsStepReached]);

  const displayConnected = simulateMode || connected;
  const displaySessionName = simulateMode ? 'Demo Session' : sessionName;

  const value: TutorialContextValue = {
    active,
    stepIndex,
    step,
    simulateMode,
    displayConnected,
    displaySessionName,
    next,
    skip,
    startTutorial,
    setSimulateMode,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function getTutorialCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setTutorialCompleted(completed: boolean): void {
  try {
    if (completed) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
