'use client'

import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('UI error boundary caught:', error)
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-6 text-red-700">Something went wrong.</div>
    }
    return this.props.children
  }
}

