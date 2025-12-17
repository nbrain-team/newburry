"use client"

import { useState, useRef } from 'react'

interface VoiceInputProps {
  onTranscript: (transcript: string) => void
  disabled?: boolean
}

export function VoiceInput({ onTranscript, disabled = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('xsourcing_token') : null

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch(`${apiBase}/api/agent-chat/transcribe`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      })

      const data = await response.json()
      
      if (data.success && data.transcript) {
        onTranscript(data.transcript)
      } else {
        alert('Failed to transcribe audio. Please try again.')
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      alert('Error transcribing audio. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isProcessing}
      className={`p-3 rounded-lg transition-all ${
        isRecording
          ? 'bg-red-600 text-white animate-pulse'
          : isProcessing
          ? 'bg-gray-300 text-gray-600 cursor-wait'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isRecording ? 'Stop recording' : isProcessing ? 'Processing...' : 'Start voice input'}
    >
      {isProcessing ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      )}
    </button>
  )
}

