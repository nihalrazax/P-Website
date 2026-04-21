// to get current year
function getYear() {
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    document.querySelector("#displayYear").innerHTML = currentYear;
}

getYear();

// ============================================
// Booking Form - Client-side validation & submission
// Replaces submit_booking.php with Google Apps Script
// ============================================

// TODO: Replace this URL with your deployed Google Apps Script web app URL
// To deploy: Open google-script.gs in Google Apps Script Editor > Deploy > New Deployment > Web App
var GOOGLE_SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL';

function validateBookingData(data) {
    var errors = [];

    if (!data.name || data.name.trim().length < 3) {
        errors.push("Name is required and must be at least 3 characters");
    }

    if (!data.phone || !/^[0-9]{10}$/.test(data.phone)) {
        errors.push("Valid 10-digit phone number is required");
    }

    if (!data.date) {
        errors.push("Date is required");
    }

    return errors;
}

function submitBooking(formData) {
    var errors = validateBookingData(formData);

    if (errors.length > 0) {
        alert(errors.join("\n"));
        return;
    }

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(function () {
        alert('Your booking request has been submitted successfully!');
    })
    .catch(function () {
        alert('Something went wrong. Please try again.');
    });
}

// toggle overlay menu
function openNav() {
    document.getElementById("myNav").classList.toggle("menu_width");
    document.querySelector(".custom_menu-btn").classList.toggle("menu_btn-style");
}

// nice select
$(document).ready(function () {
    $('select').niceSelect();
});

// slick slider

$(".slider_container").slick({
    autoplay: true,
    autoplaySpeed: 10000,
    speed: 600,
    slidesToShow: 4,
    slidesToScroll: 1,
    pauseOnHover: false,
    draggable: false,
    prevArrow: '<button class="slick-prev"> </button>',
    nextArrow: '<button class="slick-next"></button>',
    responsive: [{
            breakpoint: 991,
            settings: {
                slidesToShow: 3,
                slidesToScroll: 1,
                adaptiveHeight: true,
            },
        },
        {
            breakpoint: 767,
            settings: {
                slidesToShow: 3,
                slidesToScroll: 1,
            },
        },
        {
            breakpoint: 576,
            settings: {
                slidesToShow: 2,
                slidesToScroll: 1,
            },
        },
        {
            breakpoint: 420,
            settings: {
                slidesToShow: 1,
                slidesToScroll: 1,
            },
        }
    ]
});