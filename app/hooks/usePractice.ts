import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Alert } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { storage } from '../../utils/storage';
import config from '../../constants/Config';
import { PracticeItem, FeedbackResponse, DifficultyDirection, DifficultyTrend } from '../types/practice';

export function usePractice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [currentPractice, setCurrentPractice] = useState<PracticeItem | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [questionQueue, setQuestionQueue] = useState<PracticeItem[]>([]);
  const [adjusting, setAdjusting] = useState(false);
  const [difficultyTrend, setDifficultyTrend] = useState<DifficultyTrend>('stable');
  const previousDifficultyRef = useRef<number | null>(null);
  const [difficultyChange, setDifficultyChange] = useState<string | null>(null);
  const [feedbackQuestion, setFeedbackQuestion] = useState('');
  const [feedbackAnswer, setFeedbackAnswer] = useState<string | null>(null);
  const [askingQuestion, setAskingQuestion] = useState(false);

  // Function to generate practice with additional error handling
  const generatePractice = async (forceNew = false) => {
    try {
      setErrorMessage(null);
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to practice');
        return;
      }
      
      // Clear all feedback-related state
      setFeedback(null);
      setUserAnswer('');
      setFeedbackQuestion('');
      setFeedbackAnswer(null);
      setAskingQuestion(false);
      
      // If we're not forcing new generation and we have questions in the queue, use the next one
      if (!forceNew && questionQueue.length > 0) {
        const nextQuestion = questionQueue[0];
        const remainingQuestions = questionQueue.slice(1);
        
        setCurrentPractice(nextQuestion);
        setQuestionQueue(remainingQuestions);
        
        // If we're running low on queued questions, generate more in the background
        if (remainingQuestions.length < 2 && !generatingBatch) {
          generatePracticeBatch();
        }
        
        return;
      }
      
      // Otherwise, we need to fetch from the server
      setLoading(true);
      
      const token = await storage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await axios.post(`${config.API_URL}/api/practice/generate`, {
        userId: user._id,
        random: true, // Request random questions instead of specific type
        batchSize: 5 // Request 5 questions at once
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Ensure we have valid data before setting it
      if (response.data?.success && response.data?.data) {
        // Make a safe copy of the data with fallbacks
        const practice: PracticeItem = {
          _id: response.data.data._id || '',
          content: response.data.data.content || '',
          translation: response.data.data.translation || '',
          type: response.data.data.type || 'vocabulary',
          difficulty: response.data.data.difficulty || 1,
          complexity: response.data.data.complexity || 1,
          categories: Array.isArray(response.data.data.categories) ? response.data.data.categories : [],
          questionType: response.data.data.questionType || '',
          options: Array.isArray(response.data.data.options) ? response.data.data.options : []
        };
        
        setCurrentPractice(practice);
      } else {
        throw new Error('Invalid practice data received');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to generate practice: ${errorMsg}`);
      Alert.alert('Error', 'Failed to generate practice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to generate a batch of practice questions in the background
  const generatePracticeBatch = async () => {
    if (!user || generatingBatch) return;
    
    try {
      setGeneratingBatch(true);
      
      const token = await storage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await axios.post(`${config.API_URL}/api/practice/generate`, {
        userId: user._id,
        random: true, // Request random questions instead of specific type
        batchSize: 5 // Request 5 questions at once
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data?.success && response.data?.data) {
        // Current implementation only returns the first practice, so we don't add anything to queue here
        // Backend will store the rest for later fetching
      }
    } catch (error) {
      // Don't show error to user for background generation
    } finally {
      setGeneratingBatch(false);
    }
  };

  // Function to submit user's answer
  const submitAnswer = async () => {
    try {
      setErrorMessage(null);
      
      if (!currentPractice) {
        Alert.alert('Error', 'No practice question available');
        return;
      }
      
      if (!userAnswer || !userAnswer.trim()) {
        Alert.alert('Error', 'Please provide an answer');
        return;
      }
      
      setLoading(true);
      
      const token = await storage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await axios.post(`${config.API_URL}/api/practice/submit`, {
        practiceId: currentPractice._id,
        userAnswer: userAnswer
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Handle potential array or undefined values in feedback
      let feedbackText: string | string[] = '';
      let isCorrect = false;
      
      if (response.data?.success && response.data?.data) {
        // Store the next practice item in the queue if available
        if (response.data.data.nextPractice) {
          setQuestionQueue(prevQueue => [...prevQueue, response.data.data.nextPractice]);
        }
        
        if (response.data.data.evaluation) {
          const evaluation = response.data.data.evaluation;
          
          isCorrect = Boolean(evaluation.isCorrect);
          
          if (evaluation.feedback !== undefined) {
            if (Array.isArray(evaluation.feedback)) {
              feedbackText = evaluation.feedback;
            } else {
              feedbackText = evaluation.feedback;
            }
          }
        }
      }
      
      setFeedback({
        isCorrect,
        feedback: feedbackText
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to submit answer: ${errorMsg}`);
      Alert.alert('Error', 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Function to adjust difficulty level
  const adjustDifficulty = async (direction: DifficultyDirection) => {
    try {
      setAdjusting(true);
      setErrorMessage(null);
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to adjust difficulty');
        return;
      }
      
      const token = await storage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await axios.post(`${config.API_URL}/api/practice/adjust-difficulty`, {
        direction // No longer need to specify type
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data?.success) {
        const newLevel = response.data.data.level;
        // Save the old difficulty for comparison
        const oldDifficulty = currentPractice?.difficulty ? currentPractice.difficulty.toFixed(2) : '1.00';
        
        // Update difficulty trend immediately for visual feedback
        setDifficultyTrend(direction === 'up' ? 'increasing' : 'decreasing');
        
        // Calculate and display the change
        const oldValue = parseFloat(oldDifficulty);
        const newValue = parseFloat(newLevel.toFixed(2));
        const change = (newValue - oldValue).toFixed(2);
        const sign = change.startsWith('-') ? '' : '+';
        setDifficultyChange(`${sign}${change}`);
        
        // Show alert with more detailed information
        Alert.alert(
          'Difficulty Adjusted',
          `Your difficulty level has changed from ${oldDifficulty} to ${newLevel.toFixed(2)}.\n\nChange: ${sign}${change}\n\nNew questions will reflect this change.`,
          [{ text: 'OK' }]
        );
        
        // Force a new practice generation with the updated difficulty
        generatePractice(true);
        
        // Clear the change message after some time
        setTimeout(() => {
          setDifficultyChange(null);
        }, 15000);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Failed to adjust difficulty: ${errorMsg}`);
      Alert.alert('Error', 'Failed to adjust difficulty. Please try again.');
    } finally {
      setAdjusting(false);
    }
  };

  // Function to show difficulty adjustment dialog
  const showAdjustmentDialog = () => {
    try {
      Alert.alert(
        'Adjust Difficulty Level',
        'How would you like to adjust the difficulty of your practice questions?',
        [
          {
            text: 'Make it Easier (-1.0)',
            onPress: () => adjustDifficulty('down')
          },
          {
            text: 'Make it Harder (+1.0)',
            onPress: () => adjustDifficulty('up')
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {}
          }
        ],
        { cancelable: true }
      );
    } catch (error) {
      // Fallback in case Alert.alert fails
      const direction = confirm('Make questions harder? (Cancel for easier)') ? 'up' : 'down';
      adjustDifficulty(direction);
    }
  };

  // Function to handle asking a question about the feedback
  const askFeedbackQuestion = async () => {
    if (!feedbackQuestion.trim() || !currentPractice || !feedback) return;
    
    try {
      setAskingQuestion(true);
      setFeedbackAnswer(null);
      
      const token = await storage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
      
      const response = await axios.post(
        `${config.API_URL}/api/practice/question`,
        {
          question: feedbackQuestion,
          practiceId: currentPractice._id,
          userAnswer,
          feedback: feedback.feedback
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data && response.data.answer) {
        setFeedbackAnswer(response.data.answer);
      } else {
        Alert.alert('Error', 'The response from the server was in an unexpected format.');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to get an answer. Please try again.');
    } finally {
      setAskingQuestion(false);
    }
  };

  // Function to clear practice state including feedback questions
  const handleNextPractice = () => {
    // Clear all feedback-related state
    setFeedback(null);
    setUserAnswer('');
    setFeedbackQuestion('');
    setFeedbackAnswer(null);
    setAskingQuestion(false);
    
    // Generate a new practice question
    generatePractice();
  };

  // Update difficulty trend when current practice changes
  useEffect(() => {
    if (currentPractice && currentPractice.difficulty) {
      if (previousDifficultyRef.current !== null) {
        if (currentPractice.difficulty > previousDifficultyRef.current) {
          setDifficultyTrend('increasing');
        } else if (currentPractice.difficulty < previousDifficultyRef.current) {
          setDifficultyTrend('decreasing');
        } else {
          setDifficultyTrend('stable');
        }
      }
      previousDifficultyRef.current = currentPractice.difficulty;
    }
  }, [currentPractice]);

  // Load initial practice when component mounts
  useEffect(() => {
    if (user) {
      generatePractice(true);
    }
  }, [user]);

  return {
    loading,
    generatingBatch,
    currentPractice,
    userAnswer,
    feedback,
    errorMessage,
    adjusting,
    difficultyTrend,
    difficultyChange,
    feedbackQuestion,
    feedbackAnswer,
    askingQuestion,
    
    setUserAnswer,
    setFeedbackQuestion,
    
    generatePractice,
    submitAnswer,
    handleNextPractice,
    showAdjustmentDialog,
    askFeedbackQuestion,
    adjustDifficulty
  };
} 