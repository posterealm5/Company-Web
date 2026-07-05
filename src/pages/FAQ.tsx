import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { getStaticPageMetadata } from '../services/metadata';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle, ArrowLeft, Mail, Phone, Copy, MessageCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

export default function FAQ() {
  const { triggerNotification } = useCart();

  const handleCopyEmail = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const email = 'posterealm5@gmail.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = email;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
      document.body.removeChild(textarea);
    }
    triggerNotification('Email copied successfully');
  };


  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const faqData: FAQItem[] = [
    {
      question: 'Do you ship across India?',
      answer: (
        <p className="text-gray-700 leading-relaxed font-medium">
          Yes! We deliver posters across India. Delivery timelines may vary depending on your location and courier service availability.
        </p>
      )
    },
    {
      question: 'How do coupons work?',
      answer: (
        <div className="space-y-4 text-gray-700 leading-relaxed font-medium">
          <p>Posterealm offers different types of coupons.</p>
          
          <div className="border-l-4 border-brand-red pl-4 space-y-2 bg-brand-white/50 p-3 comic-border border-brand-black shadow-none">
            <h4 className="font-bold text-brand-black uppercase tracking-wider text-sm">Buy X Get Y Free Coupons:</h4>
            <p className="text-xs text-gray-500 font-bold mb-1">Examples: Buy 5 Get 2 Free | Buy 6 Get 3 Free | Buy 7 Get 5 Free</p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Add the required number of posters to your cart.</li>
              <li>Apply the coupon code.</li>
              <li>Select your free poster designs.</li>
              <li>The free posters will be added automatically.</li>
            </ol>
          </div>

          <div className="border-l-4 border-brand-black pl-4 space-y-1 bg-brand-white/50 p-3 comic-border shadow-none">
            <h4 className="font-bold text-brand-black uppercase tracking-wider text-sm">Percentage Discount Coupons:</h4>
            <p className="text-sm">
              Example: <span className="font-mono bg-brand-red text-white px-2 py-0.5 font-bold">FREE10</span> – Get 10% off on orders above ₹1500.
            </p>
          </div>

          <p className="text-xs font-bold text-brand-red uppercase tracking-wider">Only one coupon can be applied per order.</p>
        </div>
      )
    },
    {
      question: 'How can I track my order?',
      answer: (
        <p className="text-gray-700 leading-relaxed font-medium">
          Once your order is shipped, tracking information will be shared through the contact details provided during checkout.
        </p>
      )
    },
    {
      question: 'How much time does it take to manufacture the poster?',
      answer: (
        <p className="text-gray-700 leading-relaxed font-medium">
          Most orders are crafted and processed within 24 hours.
        </p>
      )
    },
    {
      question: 'Will I receive adhesive for sticking the poster?',
      answer: (
        <p className="text-gray-700 leading-relaxed font-medium">
          Yes. Posters are shipped with adhesive stickers to help you easily mount them on your wall.
        </p>
      )
    },
    {
      question: 'Can I combine multiple coupons?',
      answer: (
        <p className="text-gray-700 leading-relaxed font-medium">
          No. Only one coupon can be used per order.
        </p>
      )
    },
    {
      question: 'Can I cancel my order?',
      answer: (
        <p className="text-gray-700 leading-relaxed font-medium">
          Orders may be cancelled before production begins. Once manufacturing has started, cancellation requests may not be possible.
        </p>
      )
    },
    {
      question: 'Can I upload my own poster design?',
      answer: (
        <div className="space-y-3 text-gray-700 leading-relaxed font-medium">
          <p>
            Yes. You can create custom posters by uploading your own artwork through our{' '}
            <Link to="/customize" className="text-brand-red underline font-bold hover:text-brand-black transition-colors">
              Customize section
            </Link>
            .
          </p>
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-xs space-y-1 text-amber-900 comic-border border-brand-black shadow-none">
            <p className="font-bold uppercase tracking-wider">Please ensure that:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>You own the rights to the uploaded artwork.</li>
              <li>Or you have permission to use it.</li>
            </ul>
          </div>
          <p className="text-xs italic text-gray-500">
            Posterealm reserves the right to reject inappropriate or prohibited content.
          </p>
        </div>
      )
    },
    {
      question: 'What file formats are supported?',
      answer: (
        <div className="space-y-2 text-gray-700 leading-relaxed font-medium">
          <p>Supported formats:</p>
          <ul className="list-disc pl-5 font-mono text-sm space-y-0.5">
            <li>JPG</li>
            <li>JPEG</li>
            <li>PNG</li>
          </ul>
          <p className="text-xs text-brand-red font-bold uppercase tracking-wider">
            For best results, upload high-resolution images.
          </p>
        </div>
      )
    },
    {
      question: 'How can I contact Posterealm support?',
      answer: (
        <div className="space-y-4 text-gray-700 leading-relaxed font-medium">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <a 
                href="mailto:posterealm5@gmail.com" 
                className="flex items-center gap-2 text-brand-black hover:text-brand-red transition-colors font-bold text-sm"
              >
                <Mail size={16} className="text-brand-red shrink-0" />
                posterealm5@gmail.com
              </a>
              <button 
                onClick={(e) => handleCopyEmail(e)}
                className="p-1.5 bg-brand-black text-white hover:bg-brand-red hover:text-white transition-colors comic-border border-2 shadow-none py-0.5 text-xs font-black uppercase tracking-wider flex items-center gap-1 shrink-0"
                title="Copy Email"
              >
                <Copy size={12} />
                <span>Copy</span>
              </button>
            </div>
            <div className="flex flex-col gap-1 text-sm font-bold pl-6">
              <span className="text-xs text-gray-500 font-medium">WhatsApp Support:</span>
              <a 
                href="https://wa.me/918949923501?text=Hi%20Posterealm,%20I%20have%20a%20question%20regarding%20your%20FAQ." 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1 hover:text-brand-red transition-colors"
              >
                <MessageCircle size={16} className="text-brand-red shrink-0" />
                <span>WhatsApp Support</span>
              </a>
            </div>
          </div>
        </div>
      )
    },
    {
      question: 'What should I do if the website keeps loading continuously?',
      answer: (
        <div className="space-y-2 text-gray-700 leading-relaxed font-medium">
          <p>In rare cases, browser cache or network interruptions may cause continuous loading.</p>
          <p className="font-bold text-xs uppercase tracking-wider text-brand-black">Please:</p>
          <ol className="list-decimal pl-5 space-y-1 text-sm">
            <li>Refresh the page.</li>
            <li>Clear your browser cache if necessary.</li>
            <li>Reopen the website.</li>
          </ol>
          <p className="text-xs text-gray-500">If the issue continues, contact support.</p>
        </div>
      )
    }
  ];

  return (
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getStaticPageMetadata('FAQ', 'FAQ | Posterealm', 'Frequently Asked Questions about orders, coupons, tracking, custom poster designs, and support at Posterealm.')} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back Button */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-brand-black font-black uppercase tracking-wider hover:text-brand-red transition-colors mb-8 group text-xs md:text-sm"
        >
          <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        {/* Title */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            FREQUENTLY ASKED <span className="text-brand-red">QUESTIONS</span>
          </h1>
          <p className="text-lg text-gray-600 font-medium max-w-2xl font-sans">
            Got questions? We've got answers. Explore our guides on order tracking, custom design uploads, and coupon applications.
          </p>
        </motion.div>

        {/* Accordions */}
        <div className="space-y-6">
          {faqData.map((item, idx) => {
            const isOpen = activeIndex === idx;
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="bg-white border-3 border-brand-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(230,57,70,1)] transition-all duration-300 overflow-hidden"
              >
                <button
                  onClick={() => toggleAccordion(idx)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                >
                  <div className="flex items-center gap-4">
                    <HelpCircle size={20} className={isOpen ? "text-brand-red shrink-0" : "text-brand-black shrink-0"} />
                    <span className="font-display text-xl md:text-2xl font-black uppercase tracking-tight text-brand-black">
                      {item.question}
                    </span>
                  </div>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-brand-black shrink-0 ml-4"
                  >
                    <ChevronDown size={20} />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                    >
                      <div className="px-6 pb-6 pt-2 border-t-2 border-dashed border-gray-100 font-sans">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 bg-brand-black text-brand-white p-8 comic-border flex flex-col md:flex-row justify-between items-center gap-6"
        >
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tight text-brand-red">STILL HAVE QUESTIONS?</h3>
            <p className="text-gray-400 font-medium text-sm font-sans">Our team is ready to help you print your dreams.</p>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <a 
              href="mailto:posterealm5@gmail.com" 
              className="px-6 py-3 bg-brand-red text-white text-xs font-black uppercase tracking-widest comic-border border-white hover:bg-brand-white hover:text-brand-black hover:border-brand-black transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-none"
            >
              Email Support
            </a>
            <button 
              onClick={(e) => handleCopyEmail(e)}
              className="px-6 py-3 bg-brand-black text-brand-white text-xs font-black uppercase tracking-widest comic-border border-white hover:bg-white hover:text-brand-black transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-none flex items-center gap-2"
            >
              <Copy size={14} />
              <span>Copy Email</span>
            </button>
            <a 
              href="https://wa.me/918949923501?text=Hi%20Posterealm,%20I%20have%20a%20question%20regarding%20your%20FAQ." 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-6 py-3 bg-white text-brand-black text-xs font-black uppercase tracking-widest comic-border border-brand-black hover:bg-brand-red hover:text-white transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
            >
              WhatsApp Support
            </a>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
