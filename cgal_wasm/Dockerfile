FROM emscripten/emsdk:latest

ARG CGAL_VERSION=6.2.1
ARG BOOST_VERSION=1.81.0
ARG BOOST_UNDERSCORE=1_81_0

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        wget \
        unzip \
        tar \
        bzip2 \
        ca-certificates \
        # libboost-all-dev \
        libeigen3-dev \
        # GMP library for boost::multiprecision namespace \
        libgmp-dev \
        libmpfr-dev \
        # google unit tests \
        libgtest-dev && \ 
    rm -rf /var/lib/apt/lists/*

# CGAL headers
RUN wget -q \
    https://github.com/CGAL/cgal/releases/download/v${CGAL_VERSION}/CGAL-${CGAL_VERSION}-library.zip \
    -O /tmp/cgal.zip && \
    mkdir -p /opt/cgal && \
    unzip -q /tmp/cgal.zip -d /opt/cgal && \
    rm /tmp/cgal.zip

# Boost headers
RUN wget -q \
    https://archives.boost.io/release/${BOOST_VERSION}/source/boost_${BOOST_UNDERSCORE}.tar.bz2 \
    -O /tmp/boost.tar.bz2 && \
    mkdir -p /opt/boost && \
    tar -xjf /tmp/boost.tar.bz2 \
        --strip-components=1 \
        -C /opt/boost && \
    rm /tmp/boost.tar.bz2

WORKDIR /src

